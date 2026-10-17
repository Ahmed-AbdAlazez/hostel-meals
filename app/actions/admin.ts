"use server";

import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { sendPushToUser } from "@/lib/push";
import { revalidatePath } from "next/cache";

async function verifyAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("غير مصرح: يجب تسجيل الدخول");
  }

  const adminEmail = process.env.ADMIN_EMAIL || "";
  const adminEmails = adminEmail.split(",").map((e) => e.trim().toLowerCase());
  const isMatch =
    user.role === "admin" ||
    adminEmails.includes(user.email.toLowerCase());

  if (!isMatch) {
    throw new Error("غير مصرح: هذا الإجراء متاح لمدير النظام فقط");
  }

  return user;
}

export async function adminApproveStudent(userId: string) {
  await verifyAdmin();
  const sql = getDb();

  await sql`
    UPDATE profiles
    SET approval_status = 'approved',
        updated_at = now()
    WHERE id = ${userId}
  `;

  // Send push notification to the student
  try {
    await sendPushToUser(userId, {
      title: "تمت الموافقة على حسابك 🎉",
      body: "وافق الأدمن على طلب انضمامك. يمكنك الآن تسجيل الدخول وربط حساب الزهراء.",
      data: {
        url: "/link-zahraa",
      },
    });
  } catch (err) {
    console.error("Failed to send approval push:", err);
  }

  revalidatePath("/admin");
  return { success: true, message: "تمت الموافقة على الطالب بنجاح" };
}

export async function adminRejectStudent(userId: string) {
  await verifyAdmin();
  const sql = getDb();

  await sql`
    UPDATE profiles
    SET approval_status = 'rejected',
        is_active = false,
        updated_at = now()
    WHERE id = ${userId}
  `;

  revalidatePath("/admin");
  return { success: true, message: "تم رفض طلب الانضمام" };
}

export async function adminTogglePause(userId: string, isActive: boolean) {
  await verifyAdmin();
  const sql = getDb();

  await sql`
    UPDATE profiles
    SET is_active = ${isActive},
        updated_at = now()
    WHERE id = ${userId}
  `;

  revalidatePath("/admin");
  return {
    success: true,
    message: isActive ? "تم تنشيط حساب الطالب" : "تم إيقاف حساب الطالب مؤقتاً",
  };
}

export async function adminDeleteStudent(userId: string) {
  await verifyAdmin();
  const sql = getDb();

  // Cascade delete on profiles removes credentials, subscriptions, and requests
  await sql`
    DELETE FROM profiles
    WHERE id = ${userId}
  `;

  revalidatePath("/admin");
  return { success: true, message: "تم حذف حساب الطالب وجميع بياناته بنجاح" };
}

/**
 * Reveals Al-Zahraa password to admin browser.
 * Decrypts in memory on server and returns directly. Never logged.
 */
export async function adminRevealPassword(userId: string) {
  await verifyAdmin();
  const sql = getDb();

  const creds = await sql`
    SELECT password_enc, password_iv, password_tag, national_id_enc, national_id_iv, national_id_tag
    FROM zahraa_credentials
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  if (!creds || creds.length === 0) {
    return { success: false, message: "لم يتم العثور على بيانات مربوطة لهذا الطالب" };
  }

  const row = creds[0];

  try {
    const password = decrypt({
      ciphertext: row.password_enc as string,
      iv: row.password_iv as string,
      tag: row.password_tag as string,
    });
    const nationalId = decrypt({
      ciphertext: row.national_id_enc as string,
      iv: row.national_id_iv as string,
      tag: row.national_id_tag as string,
    });

    return {
      success: true,
      nationalId,
      password,
    };
  } catch {
    return { success: false, message: "فشل فك تشفير كلمة المرور" };
  }
}
