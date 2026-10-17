import Link from "next/link";
import DottedTrailCursor from "@/components/ui/dotted-trail-cursor";
import { Button } from "@/components/ui/button";
import { Utensils, Bell, Clock, ShieldCheck, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Navbar } from "@/components/navbar";

export default function HomePage() {
  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="relative flex-1">
        <DottedTrailCursor
          colorA="#f59e0b"
          colorB="#f43f5e"
          headRadius={70}
          glowRadius={260}
          className="!min-h-[calc(100vh-4rem)] !h-auto flex flex-col justify-center py-12"
        >
          <div className="container mx-auto px-4 sm:px-6 max-w-4xl flex flex-col items-center text-center">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 mb-6 backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>مساعد طلاب سكن الزهراء — جامعة القاهرة</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.2] mb-6 max-w-2xl">
              لا تفوت وجبة بعد اليوم..{" "}
              <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">
                الحجز بضغطة زر واحدة
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-base sm:text-xl text-muted-foreground max-w-xl mb-8 leading-relaxed">
              إشعار يومي يوصلك الساعة 4:00 عصراً.. تختار غداء أو عشاء أو الاثنين، والنظام يسجل دخول ويثبت حجزك فوراً في موقع الزهراء الرسمي قبل قفل الموعد الساعة 8:00 مساءً.
            </p>

            {/* Call to Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto mb-12">
              <Link href="/register" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="gradient"
                  className="w-full sm:w-auto gap-2 text-base font-bold shadow-lg shadow-orange-500/20"
                >
                  إنشاء حساب طالب جديد
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto text-base font-semibold border-border/80 backdrop-blur-md bg-card/70"
                >
                  تسجيل الدخول
                </Button>
              </Link>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-start">
              <div className="p-5 rounded-2xl border border-border/80 bg-card/85 backdrop-blur-md shadow-sm transition-all hover:border-amber-500/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 mb-3">
                  <Bell className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-foreground text-base mb-1">إشعار يومي ذكي</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  يصلك إشعار Push على هاتفك الساعة 4 عصراً، مع خيارات مباشرة للحجز بدون فتح المتصفح.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-border/80 bg-card/85 backdrop-blur-md shadow-sm transition-all hover:border-orange-500/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 mb-3">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-foreground text-base mb-1">تذكير وأمان للموعد</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  تذكير ثانٍ 6:30 مساءً لو ما رديتش، والتزام حاسم بإيقاف الحجز قبل الساعة 8 مساءً القاهرة.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-border/80 bg-card/85 backdrop-blur-md shadow-sm transition-all hover:border-rose-500/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 mb-3">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-foreground text-base mb-1">تشفير وحماية البيانات</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  تشفير قوي AES-256 للرقم القومي وكلمة المرور، والتحقق المباشر من الوجبات بعد الحجز.
                </p>
              </div>
            </div>

            {/* Micro info */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                دعم كامل للهواتف والأندرويد (PWA)
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                وضع الإجازة لتعطيل الحجز المؤقت
              </span>
            </div>
          </div>
        </DottedTrailCursor>
      </main>
    </div>
  );
}
