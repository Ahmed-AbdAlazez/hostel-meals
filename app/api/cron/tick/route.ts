import { NextRequest, NextResponse } from "next/server";
import {
  getCairoNow,
  getTomorrowCairoDate,
  formatArabicDate,
  isAtOrAfterCairoTime,
  isPastCairoBookingDeadline,
  getCairoTodayDeadlineIso,
} from "@/lib/time";
import { getDb } from "@/lib/db";
import { decrypt, generateToken, hashToken } from "@/lib/crypto";
import {
  loginToZahraa,
  fetchMeals,
  categorizeMeal,
  ZahraaError,
} from "@/lib/zahraa";
import { sendPushToUser } from "@/lib/push";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET(req: NextRequest) {
  // 1. Verify CRON_SECRET authorization header
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (
    !cronSecret ||
    authHeader !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing CRON_SECRET" },
      { status: 401 }
    );
  }

  const now = new Date();
  const cairo = getCairoNow(now);
  const tomorrow = getTomorrowCairoDate(now);
  const tomorrowArabic = formatArabicDate(tomorrow);
  const deadlineIso = getCairoTodayDeadlineIso(now);

  const sql = getDb();
  const logs: string[] = [];

  // ==========================================
  // PHASE 3: AFTER 20:00 -> Expire unanswered requests
  // ==========================================
  if (isPastCairoBookingDeadline(now)) {
    const expiredRows = await sql`
      UPDATE booking_requests
      SET status = 'expired',
          result_message = 'انتهت مهلة الحجز اليومية دون رد',
          updated_at = now()
      WHERE target_date = ${tomorrow}
        AND status = 'asked'
      RETURNING id
    `;

    const expiredCount = expiredRows?.length || 0;
    logs.push(`Phase 3 (Post 20:00): Expired ${expiredCount} unanswered requests.`);

    return NextResponse.json({
      success: true,
      cairoTime: cairo.timeStr,
      phase: "post_deadline",
      logs,
    });
  }

  // ==========================================
  // PHASE 2: AT OR AFTER 18:30 -> Send Reminders
  // ==========================================
  if (isAtOrAfterCairoTime(18, 30, now)) {
    const pendingReminders = await sql`
      SELECT id, user_id, target_date
      FROM booking_requests
      WHERE target_date = ${tomorrow}
        AND status = 'asked'
        AND reminded_at IS NULL
      LIMIT 20
    `;

    if (pendingReminders && pendingReminders.length > 0) {
      for (const reqRow of pendingReminders) {
        const token = generateToken();
        const tokenHash = hashToken(token);

        await sql`
          UPDATE booking_requests
          SET token_hash = ${tokenHash},
              token_expires_at = ${deadlineIso},
              reminded_at = now(),
              updated_at = now()
          WHERE id = ${reqRow.id}
        `;

        await sendPushToUser(reqRow.user_id as string, {
          title: "تذكير: باقي أقل من ساعة ونصف على قفل الحجز ⏳",
          body: `حجز وجبات ${tomorrowArabic} بيقفل الساعة 8:00 مساءً — اختار الآن`,
          actions: [
            { action: "book_both", title: "غداء + عشاء" },
            { action: "skip", title: "لا" },
          ],
          data: {
            token,
            targetDate: tomorrow,
            url: "/dashboard",
            type: "booking_prompt",
          },
        });

        await sleep(500);
      }
      logs.push(`Phase 2 (18:30 Reminder): Sent reminders to ${pendingReminders.length} students.`);
    }
  }

  // ==========================================
  // PHASE 1: AT OR AFTER 16:00 -> Daily Booking Prompt
  // ==========================================
  if (isAtOrAfterCairoTime(16, 0, now)) {
    const activeStudents = await sql`
      SELECT id, full_name, email
      FROM profiles
      WHERE role = 'student'
        AND approval_status = 'approved'
        AND is_active = true
        AND credentials_invalid = false
    `;

    if (!activeStudents || activeStudents.length === 0) {
      return NextResponse.json({
        success: true,
        cairoTime: cairo.timeStr,
        message: "No active approved students to process",
        logs,
      });
    }

    let processedCount = 0;

    for (const student of activeStudents) {
      const existing = await sql`
        SELECT id, status
        FROM booking_requests
        WHERE user_id = ${student.id}
          AND target_date = ${tomorrow}
        LIMIT 1
      `;

      if (existing && existing.length > 0) {
        continue;
      }

      // Fetch student credentials
      const credsRows = await sql`
        SELECT *
        FROM zahraa_credentials
        WHERE user_id = ${student.id}
        LIMIT 1
      `;

      if (!credsRows || credsRows.length === 0) {
        continue;
      }

      const creds = credsRows[0];
      let nationalId: string;
      let password: string;
      try {
        nationalId = decrypt({
          ciphertext: creds.national_id_enc as string,
          iv: creds.national_id_iv as string,
          tag: creds.national_id_tag as string,
        });
        password = decrypt({
          ciphertext: creds.password_enc as string,
          iv: creds.password_iv as string,
          tag: creds.password_tag as string,
        });
      } catch {
        continue;
      }

      try {
        const jar = await loginToZahraa(nationalId, password);
        const mealsData = await fetchMeals(jar);
        const tomorrowSchedule = mealsData.daysDict?.[tomorrow];

        // If no meals or all meals disabled
        if (
          !tomorrowSchedule ||
          !tomorrowSchedule.meals ||
          tomorrowSchedule.meals.length === 0 ||
          tomorrowSchedule.meals.every((m) => Boolean(m.disabled))
        ) {
          await sql`
            INSERT INTO booking_requests (
              user_id, target_date, status, available_meals, result_message
            ) VALUES (
              ${student.id},
              ${tomorrow},
              'no_meals',
              ${JSON.stringify(tomorrowSchedule?.meals || [])},
              'لا توجد وجبات متاحة للحجز ليوم الغد'
            )
          `;
          continue;
        }

        // Check if tomorrow is already fully booked
        const bookableMeals = tomorrowSchedule.meals.filter(
          (m) => !Boolean(m.disabled) && categorizeMeal(m.mealName) !== "other"
        );
        const isFullyBooked =
          bookableMeals.length > 0 &&
          bookableMeals.every((m) => Boolean(m.booked));

        if (isFullyBooked) {
          await sql`
            INSERT INTO booking_requests (
              user_id, target_date, status, available_meals, result_message
            ) VALUES (
              ${student.id},
              ${tomorrow},
              'already_booked',
              ${JSON.stringify(tomorrowSchedule.meals)},
              'الوجبات محجوزة بالفعل ليوم الغد في موقع الزهراء'
            )
          `;
          continue;
        }

        // Generate one-time token for booking
        const token = generateToken();
        const tokenHash = hashToken(token);

        await sql`
          INSERT INTO booking_requests (
            user_id, target_date, status, available_meals, token_hash, token_expires_at, notified_at
          ) VALUES (
            ${student.id},
            ${tomorrow},
            'asked',
            ${JSON.stringify(tomorrowSchedule.meals)},
            ${tokenHash},
            ${deadlineIso},
            now()
          )
        `;

        await sendPushToUser(student.id as string, {
          title: "حجز وجبات بكرة 🍽",
          body: `${tomorrowArabic} — اختار قبل الساعة 8 مساءً`,
          actions: [
            { action: "book_both", title: "غداء + عشاء" },
            { action: "skip", title: "لا" },
          ],
          data: {
            token,
            targetDate: tomorrow,
            url: "/dashboard",
            type: "booking_prompt",
          },
        });
        processedCount++;
      } catch (err: unknown) {
        const error = err as ZahraaError;
        if (error.code === "INVALID_CREDENTIALS") {
          await sql`
            UPDATE profiles
            SET is_active = false,
                credentials_invalid = true,
                updated_at = now()
            WHERE id = ${student.id}
          `;

          await sendPushToUser(student.id as string, {
            title: "بيانات الزهراء غلط ⚠️",
            body: "فشل الدخول لحسابك في الزهراء، يرجى تحديث كلمة المرور في التطبيق.",
            data: {
              type: "credentials_invalid",
              url: "/link-zahraa",
            },
          });
        }
      }

      await sleep(800);
    }

    logs.push(`Phase 1 (16:00 Notification): Processed ${processedCount} student prompts for ${tomorrow}.`);
  }

  return NextResponse.json({
    success: true,
    cairoTime: cairo.timeStr,
    tomorrow,
    logs,
  });
}
