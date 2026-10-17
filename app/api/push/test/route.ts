import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً" },
        { status: 401 }
      );
    }

    const { sent, failed } = await sendPushToUser(user.id, {
      title: "تجربة الإشعارات 🔔",
      body: "تهانينا! الإشعارات تعمل بنجاح وستصلك تنبيهات حجز الوجبات يومياً في موعدها.",
      data: {
        type: "test",
        url: "/dashboard",
      },
    });

    if (sent === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "لم يتم العثور على أجهزة مسجلة تستقبل الإشعارات. تأكد من تفعيل الإشعارات أولاً في هذا المتصفح.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `تم إرسال الإشعار التجريبي بنجاح (${sent} جهاز)`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "فشل إرسال الإشعار", details: (err as Error).message },
      { status: 500 }
    );
  }
}
