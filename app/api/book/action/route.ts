import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeBookingAction } from "@/lib/booking";

const bookActionSchema = z.object({
  token: z.string().min(1, "رمز التحقق مطلوب"),
  choice: z.enum(["both", "lunch", "dinner", "skip"]),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = bookActionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: "بيانات الطلب غير صالحة",
          errors: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { token, choice } = parseResult.data;
    const result = await executeBookingAction({ token, choice });

    const httpStatus = result.success ? 200 : 400;
    return NextResponse.json(result, { status: httpStatus });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ غير متوقع أثناء معالجة الطلب",
        error: (err as Error).message,
      },
      { status: 500 }
    );
  }
}
