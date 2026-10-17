import { hashToken, decrypt } from "./crypto";
import { getDb } from "./db";
import {
  bookMealsSafely,
  BookChoice,
  ZahraaError,
} from "./zahraa";
import { sendPushToUser } from "./push";

export type BookingChoiceType = "both" | "lunch" | "dinner" | "skip";

export interface BookingActionResult {
  success: boolean;
  message: string;
  status: "booked" | "skipped" | "failed" | "expired" | "already_booked";
  chosenMeals?: string[];
}

/**
 * Atomically consumes a one-time booking token and performs the requested booking action.
 * Can be called by Service Worker in background or by Dashboard client.
 */
export async function executeBookingAction({
  token,
  choice,
}: {
  token: string;
  choice: BookingChoiceType;
}): Promise<BookingActionResult> {
  const tokenHash = hashToken(token);
  const sql = getDb();

  // 1. Atomically consume the token where status is 'asked' and token is not expired
  // Note: We use an atomic UPDATE ... RETURNING to guarantee single execution even with concurrent taps
  const requestRows = await sql`
    UPDATE booking_requests
    SET status = ${choice === "skip" ? "skipped" : "booked"},
        updated_at = now()
    WHERE token_hash = ${tokenHash}
      AND status = 'asked'
      AND token_expires_at > now()
    RETURNING *
  `;

  if (!requestRows || requestRows.length === 0) {
    // Check if it was already processed or expired
    const existingRows = await sql`
      SELECT status, target_date, token_expires_at, result_message
      FROM booking_requests
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `;

    if (existingRows && existingRows.length > 0) {
      const existing = existingRows[0];
      if (existing.status === "booked") {
        return {
          success: true,
          status: "booked",
          message: (existing.result_message as string) || "تم تسجيل حجزك مسبقاً بنجاح ✓",
        };
      }
      if (existing.status === "skipped") {
        return {
          success: true,
          status: "skipped",
          message: "تم اختيار عدم الحجز مسبقاً لهذا اليوم",
        };
      }
      if (new Date(existing.token_expires_at as string).getTime() < Date.now()) {
        return {
          success: false,
          status: "expired",
          message: "انتهت صلاحية رابط الحجز (تجاوزت الساعة 8:00 مساءً)",
        };
      }
    }

    return {
      success: false,
      status: "failed",
      message: "طلب الحجز غير صالح أو تمت معالجته بالفعل",
    };
  }

  const bookingRequest = requestRows[0];
  const userId = bookingRequest.user_id as string;
  const targetDate = typeof bookingRequest.target_date === "object"
    ? (bookingRequest.target_date as Date).toISOString().split("T")[0]
    : (bookingRequest.target_date as string);

  // If student chose to skip booking
  if (choice === "skip") {
    await sql`
      UPDATE booking_requests
      SET status = 'skipped',
          result_message = 'تم اختيار عدم حجز وجبات الغد',
          updated_at = now()
      WHERE id = ${bookingRequest.id}
    `;

    return {
      success: true,
      status: "skipped",
      message: "تم تخطي حجز وجبات الغد بنجاح",
    };
  }

  // 2. Check if user is active (not on vacation)
  const profileRows = await sql`
    SELECT is_active, credentials_invalid
    FROM profiles
    WHERE id = ${userId}
    LIMIT 1
  `;

  const profile = profileRows[0];
  if (!profile || !profile.is_active || profile.credentials_invalid) {
    const reason = !profile?.is_active
      ? "الحساب في وضع الإجازة (متوقف)"
      : "بيانات الزهراء غير صحيحة، يرجى تحديثها";

    await sql`
      UPDATE booking_requests
      SET status = 'failed',
          result_message = ${reason},
          updated_at = now()
      WHERE id = ${bookingRequest.id}
    `;

    return {
      success: false,
      status: "failed",
      message: `تعذر الحجز: ${reason}`,
    };
  }

  // 3. Fetch user's encrypted credentials
  const credsRows = await sql`
    SELECT *
    FROM zahraa_credentials
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  if (!credsRows || credsRows.length === 0) {
    await sql`
      UPDATE booking_requests
      SET status = 'failed',
          result_message = 'لم يتم العثور على بيانات حساب الزهراء المربوط',
          updated_at = now()
      WHERE id = ${bookingRequest.id}
    `;

    return {
      success: false,
      status: "failed",
      message: "بيانات حساب الزهراء غير مربوطة، يرجى ربط الحساب أولاً",
    };
  }

  const creds = credsRows[0];

  // 4. Decrypt credentials
  let nationalId: string;
  let zahraaPass: string;
  try {
    nationalId = decrypt({
      ciphertext: creds.national_id_enc as string,
      iv: creds.national_id_iv as string,
      tag: creds.national_id_tag as string,
    });
    zahraaPass = decrypt({
      ciphertext: creds.password_enc as string,
      iv: creds.password_iv as string,
      tag: creds.password_tag as string,
    });
  } catch {
    await sql`
      UPDATE booking_requests
      SET status = 'failed',
          result_message = 'فشل فك تشفير بيانات حساب الزهراء',
          updated_at = now()
      WHERE id = ${bookingRequest.id}
    `;

    return {
      success: false,
      status: "failed",
      message: "خطأ في فك تشفير البيانات المحفوظة",
    };
  }

  // 5. Execute safe booking on Al-Zahraa
  const bookChoice: BookChoice = {
    lunch: choice === "both" || choice === "lunch",
    dinner: choice === "both" || choice === "dinner",
  };

  try {
    const result = await bookMealsSafely({
      nationalId,
      password: zahraaPass,
      targetDate,
      choice: bookChoice,
    });

    // Update request to booked
    await sql`
      UPDATE booking_requests
      SET status = 'booked',
          chosen_meals = ${result.bookedMeals},
          result_message = ${result.message},
          updated_at = now()
      WHERE id = ${bookingRequest.id}
    `;

    // Send confirmation push notification
    await sendPushToUser(userId, {
      title: "تم تأكيد حجز الوجبات ✓",
      body: result.message,
      data: {
        type: "booking_result",
        targetDate,
      },
    });

    return {
      success: true,
      status: "booked",
      chosenMeals: result.bookedMeals,
      message: result.message,
    };
  } catch (err: unknown) {
    const error = err as ZahraaError;
    const arabicMsg = error.arabicMessage || "فشل إتمام الحجز في موقع الزهراء";

    // Handle invalid credentials edge case:
    // Automatically pause account, set credentials_invalid = true, notify student
    if (error.code === "INVALID_CREDENTIALS") {
      await sql`
        UPDATE profiles
        SET is_active = false,
            credentials_invalid = true,
            updated_at = now()
        WHERE id = ${userId}
      `;

      await sendPushToUser(userId, {
        title: "تنبيه: بيانات الزهراء غير صحيحة ⚠️",
        body: "فشل تسجيل الدخول للزهراء، تم إيقاف الحساب مؤقتاً لتجنب إغلاقه. يرجى تحديث كلمة المرور.",
        data: {
          type: "credentials_invalid",
          url: "/link-zahraa",
        },
      });
    }

    // Update request to failed
    await sql`
      UPDATE booking_requests
      SET status = 'failed',
          result_message = ${arabicMsg},
          updated_at = now()
      WHERE id = ${bookingRequest.id}
    `;

    // Notify user immediately that booking failed
    await sendPushToUser(userId, {
      title: "فشل الحجز ❌",
      body: arabicMsg,
      data: {
        type: "booking_result",
        targetDate,
      },
    });

    return {
      success: false,
      status: "failed",
      message: arabicMsg,
    };
  }
}
