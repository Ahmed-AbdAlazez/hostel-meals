import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parseResult = subscriptionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "بيانات الاشتراك غير صحيحة", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { endpoint, keys, userAgent } = parseResult.data;
    const sql = getDb();

    await sql`
      INSERT INTO push_subscriptions (
        user_id, endpoint, p256dh, auth, user_agent, created_at
      ) VALUES (
        ${user.id},
        ${endpoint},
        ${keys.p256dh},
        ${keys.auth},
        ${userAgent || req.headers.get("user-agent") || null},
        now()
      )
      ON CONFLICT (endpoint) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent
    `;

    return NextResponse.json({ success: true, message: "تم تفعيل الإشعارات بنجاح" });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "خطأ غير متوقع", details: (err as Error).message },
      { status: 500 }
    );
  }
}
