"use server";

import { z } from "zod";
import { getDb } from "@/lib/db";
import { hashPassword, verifyPassword, setSessionCookie, destroySession } from "@/lib/auth";
import { sendPushToAdmin } from "@/lib/push";

const registerSchema = z.object({
  fullName: z.string().trim().min(3, "الاسم بالكامل يجب ألا يقل عن 3 أحرف"),
  email: z.string().trim().email("يرجى إدخال بريد إلكتروني صالح"),
  password: z.string().min(6, "كلمة المرور يجب ألا تقل عن 6 أحرف"),
});

const loginSchema = z.object({
  email: z.string().trim().email("يرجى إدخال بريد إلكتروني صالح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export async function registerStudentAction(formData: {
  fullName: string;
  email: string;
  password: string;
}) {
  const parseResult = registerSchema.safeParse(formData);
  if (!parseResult.success) {
    return {
      success: false,
      message: parseResult.error.issues[0]?.message || "بيانات غير صالحة",
    };
  }

  const { fullName, email, password } = parseResult.data;
  const sql = getDb();

  // Check if email already registered in profiles
  const existing = await sql`
    SELECT id
    FROM profiles
    WHERE email = ${email}
    LIMIT 1
  `;

  if (existing && existing.length > 0) {
    return {
      success: false,
      message: "البريد الإلكتروني مسجل بالفعل، يرجى تسجيل الدخول",
    };
  }

  // Hash password
  const passwordHash = hashPassword(password);

  // Check if this is the admin email
  const adminEmail = process.env.ADMIN_EMAIL || "";
  const adminEmails = adminEmail.split(",").map((e) => e.trim().toLowerCase());
  const isAdmin = adminEmails.includes(email.toLowerCase());

  const newProfiles = await sql`
    INSERT INTO profiles (
      full_name,
      email,
      password_hash,
      role,
      approval_status,
      is_active
    ) VALUES (
      ${fullName},
      ${email},
      ${passwordHash},
      ${isAdmin ? "admin" : "student"},
      ${isAdmin ? "approved" : "pending"},
      false
    )
    RETURNING id, role, approval_status
  `;

  if (!newProfiles || newProfiles.length === 0) {
    return {
      success: false,
      message: "فشل إنشاء الحساب، يرجى المحاولة لاحقاً",
    };
  }

  const newProfile = newProfiles[0];

  // Set session cookie
  await setSessionCookie(newProfile.id as string);

  // Record admin event
  await sql`
    INSERT INTO admin_events (event_type, payload)
    VALUES ('new_registration', ${JSON.stringify({ userId: newProfile.id, fullName, email })})
  `;

  // Notify admin via Web Push
  if (!isAdmin) {
    try {
      await sendPushToAdmin({
        title: "طلب انضمام طالب جديد 📝",
        body: `سجل الطالب: ${fullName} (${email}). افتح لوحة الإدارة للموافقة.`,
        data: {
          url: "/admin",
          type: "admin_alert",
        },
      });
    } catch (err) {
      console.error("Failed to push admin notification:", err);
    }
  }

  return {
    success: true,
    message: isAdmin
      ? "تم إنشاء حساب الأدمن بنجاح"
      : "تم إنشاء الحساب بنجاح وهو الآن بانتظار موافقة الأدمن",
  };
}

export async function loginAction(formData: {
  email: string;
  password: string;
}) {
  const parseResult = loginSchema.safeParse(formData);
  if (!parseResult.success) {
    return {
      success: false,
      message: "بيانات الدخول غير صحيحة",
    };
  }

  const { email, password } = parseResult.data;
  const sql = getDb();

  const rows = await sql`
    SELECT id, password_hash, role, approval_status
    FROM profiles
    WHERE email = ${email}
    LIMIT 1
  `;

  // Timing safe or generic check to not expose whether email exists
  if (!rows || rows.length === 0) {
    return {
      success: false,
      message: "بيانات الدخول غير صحيحة، يرجى التأكد من البريد وكلمة المرور",
    };
  }

  const user = rows[0];
  const isValid = verifyPassword(password, user.password_hash as string);

  if (!isValid) {
    return {
      success: false,
      message: "بيانات الدخول غير صحيحة، يرجى التأكد من البريد وكلمة المرور",
    };
  }

  // Set secure HTTP-only session cookie
  await setSessionCookie(user.id as string);

  // Check if credentials are linked
  const creds = await sql`
    SELECT user_id
    FROM zahraa_credentials
    WHERE user_id = ${user.id}
    LIMIT 1
  `;

  return {
    success: true,
    role: user.role as string,
    approvalStatus: user.approval_status as string,
    hasCredentials: Boolean(creds && creds.length > 0),
  };
}

export async function logoutAction() {
  await destroySession();
  return { success: true };
}
