"use server";

import { z } from "zod";
import { getCurrentUser, destroySession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { loginToZahraa, bookMealsSafely, ZahraaError } from "@/lib/zahraa";
import { getTomorrowCairoDate, isPastCairoBookingDeadline } from "@/lib/time";
import { revalidatePath } from "next/cache";

const linkZahraaSchema = z.object({
  nationalId: z
    .string()
    .trim()
    .min(14, "الرقم القومي يجب أن يتكون من 14 رقماً")
    .max(14, "الرقم القومي لا يتجاوز 14 رقماً")
    .regex(/^\d+$/, "الرقم القومي يجب أن يحتوي على أرقام فقط"),
  password: z.string().min(1, "كلمة مرور الزهراء مطلوبة"),
});

export async function linkZahraaAccount(formData: {
  nationalId: string;
  password: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, message: "يجب تسجيل الدخول أولاً" };
  }

  // Validate inputs
  const parseResult = linkZahraaSchema.safeParse(formData);
  if (!parseResult.success) {
    const errorMsg =
      parseResult.error.issues[0]?.message || "البيانات المدخلة غير صحيحة";
    return { success: false, message: errorMsg };
  }

  const { nationalId, password } = parseResult.data;

  // 1. Actually test logging in to Al-Zahraa
  try {
    await loginToZahraa(nationalId, password);
  } catch (err: unknown) {
    const error = err as ZahraaError;
    return {
      success: false,
      message:
        error.arabicMessage ||
        "البيانات غلط أو تعذر الاتصال بموقع الزهراء، لم يتم حفظ أي بيانات",
    };
  }

  // 2. Encrypt credentials with AES-256-GCM
  const encNationalId = encrypt(nationalId);
  const encPassword = encrypt(password);

  const sql = getDb();

  // 3. Save encrypted credentials (Upsert on user_id)
  await sql`
    INSERT INTO zahraa_credentials (
      user_id,
      national_id_enc,
      national_id_iv,
      national_id_tag,
      password_enc,
      password_iv,
      password_tag,
      last_verified_at,
      updated_at
    ) VALUES (
      ${user.id},
      ${encNationalId.ciphertext},
      ${encNationalId.iv},
      ${encNationalId.tag},
      ${encPassword.ciphertext},
      ${encPassword.iv},
      ${encPassword.tag},
      now(),
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      national_id_enc = EXCLUDED.national_id_enc,
      national_id_iv = EXCLUDED.national_id_iv,
      national_id_tag = EXCLUDED.national_id_tag,
      password_enc = EXCLUDED.password_enc,
      password_iv = EXCLUDED.password_iv,
      password_tag = EXCLUDED.password_tag,
      last_verified_at = now(),
      updated_at = now()
  `;

  // 4. Activate profile and clear credentials_invalid flag
  await sql`
    UPDATE profiles
    SET is_active = true,
        credentials_invalid = false,
        updated_at = now()
    WHERE id = ${user.id}
  `;

  revalidatePath("/dashboard");
  revalidatePath("/link-zahraa");

  return {
    success: true,
    message: "تم التحقق من حساب الزهراء وربطه وتشفيره بنجاح ✓",
  };
}

/**
 * Direct meal booking action triggered from the student Dashboard.
 */
export async function bookFromDashboardAction(
  choice: "both" | "lunch" | "dinner" | "skip"
) {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "يجب تسجيل الدخول أولاً" };

  if (isPastCairoBookingDeadline()) {
    return {
      success: false,
      message: "انتهى موعد الحجز اليومي (الساعة 8:00 مساءً بتوقيت القاهرة)",
    };
  }

  const tomorrow = getTomorrowCairoDate();
  const sql = getDb();

  // 1. Fetch credentials
  const credsRows = await sql`
    SELECT *
    FROM zahraa_credentials
    WHERE user_id = ${user.id}
    LIMIT 1
  `;

  if (!credsRows || credsRows.length === 0) {
    return {
      success: false,
      message: "بيانات حساب الزهراء غير مربوطة، يرجى ربط الحساب أولاً",
    };
  }

  const creds = credsRows[0];

  // 2. If student chose to skip
  if (choice === "skip") {
    await sql`
      INSERT INTO booking_requests (
        user_id, target_date, status, result_message, updated_at
      ) VALUES (
        ${user.id}, ${tomorrow}, 'skipped', 'تم اختيار عدم حجز وجبات الغد', now()
      )
      ON CONFLICT (user_id, target_date) DO UPDATE SET
        status = 'skipped',
        result_message = 'تم اختيار عدم حجز وجبات الغد',
        updated_at = now()
    `;
    revalidatePath("/dashboard");
    return { success: true, message: "تم اختيار عدم الحجز لوجبات الغد بنجاح" };
  }

  // 3. Decrypt credentials
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
    return { success: false, message: "خطأ في فك تشفير بيانات حساب الزهراء" };
  }

  // 4. Book meals safely
  const bookChoice = {
    lunch: choice === "both" || choice === "lunch",
    dinner: choice === "both" || choice === "dinner",
  };

  try {
    const result = await bookMealsSafely({
      nationalId,
      password: zahraaPass,
      targetDate: tomorrow,
      choice: bookChoice,
    });

    await sql`
      INSERT INTO booking_requests (
        user_id, target_date, status, chosen_meals, result_message, updated_at
      ) VALUES (
        ${user.id}, ${tomorrow}, 'booked', ${result.bookedMeals}, ${result.message}, now()
      )
      ON CONFLICT (user_id, target_date) DO UPDATE SET
        status = 'booked',
        chosen_meals = ${result.bookedMeals},
        result_message = ${result.message},
        updated_at = now()
    `;

    revalidatePath("/dashboard");
    return { success: true, message: result.message };
  } catch (err: unknown) {
    const error = err as ZahraaError;
    const arabicMsg = error.arabicMessage || "فشل إتمام الحجز في موقع الزهراء";

    if (error.code === "INVALID_CREDENTIALS") {
      await sql`
        UPDATE profiles
        SET is_active = false, credentials_invalid = true, updated_at = now()
        WHERE id = ${user.id}
      `;
    }

    await sql`
      INSERT INTO booking_requests (
        user_id, target_date, status, result_message, updated_at
      ) VALUES (
        ${user.id}, ${tomorrow}, 'failed', ${arabicMsg}, now()
      )
      ON CONFLICT (user_id, target_date) DO UPDATE SET
        status = 'failed',
        result_message = ${arabicMsg},
        updated_at = now()
    `;

    revalidatePath("/dashboard");
    return { success: false, message: arabicMsg };
  }
}

/**
 * Toggle Vacation / Active status for student.
 */
export async function toggleActiveStatus(isActive: boolean) {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "غير مصرح" };

  const sql = getDb();
  await sql`
    UPDATE profiles
    SET is_active = ${isActive},
        updated_at = now()
    WHERE id = ${user.id}
  `;

  revalidatePath("/dashboard");
  return {
    success: true,
    message: isActive
      ? "تم تفعيل الحساب لاستقبال الإشعارات والحجز التلقائي"
      : "تم تفعيل وضع الإجازة (إيقاف الإشعارات والحجز)",
  };
}

/**
 * Permanent account deletion: Removes credentials, subscriptions, profile, and session.
 */
export async function deleteAccount() {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "غير مصرح" };

  const sql = getDb();
  // Deleting the profile cascades and removes all credentials, subscriptions, and requests
  await sql`
    DELETE FROM profiles
    WHERE id = ${user.id}
  `;

  await destroySession();

  return { success: true, message: "تم حذف الحساب وجميع البيانات نهائياً" };
}
