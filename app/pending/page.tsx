import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DottedTrailCursor from "@/components/ui/dotted-trail-cursor";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Clock, XCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";

export default async function PendingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const status = user.approval_status || "pending";

  // If already approved, proceed to link-zahraa
  if (status === "approved") {
    redirect("/link-zahraa");
  }

  const isRejected = status === "rejected";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar user={user} />

      <main className="flex-1 relative">
        <DottedTrailCursor
          colorA={isRejected ? "#ef4444" : "#f59e0b"}
          colorB={isRejected ? "#991b1b" : "#f43f5e"}
          headRadius={70}
          className="!min-h-[calc(100vh-4rem)] !h-auto flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md my-8">
            <Card className="border-border/80 bg-card/90 shadow-2xl backdrop-blur-xl text-center">
              <CardHeader className="space-y-4 pb-4">
                <div
                  className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl shadow-md ${
                    isRejected
                      ? "bg-destructive/15 text-destructive"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {isRejected ? (
                    <XCircle className="h-8 w-8" />
                  ) : (
                    <Clock className="h-8 w-8 animate-pulse" />
                  )}
                </div>

                <CardTitle className="text-2xl font-bold">
                  {isRejected ? "تم رفض الطلب" : "طلبك قيد المراجعة"}
                </CardTitle>

                <CardDescription className="text-base leading-relaxed">
                  {isRejected ? (
                    <span className="text-destructive font-medium">
                      نعتذر، تم رفض طلب انضمامك للتطبيق من قبل الأدمن. يرجى مراجعة مسؤول المجموعة لمزيد من التفاصيل.
                    </span>
                  ) : (
                    <span>
                      أهلاً بك يا <strong>{user.full_name || "صديقنا"}</strong>! طلبك وصل للأدمن، وهتقدر تكمل بعد الموافقة وتفعيل حسابك.
                    </span>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 pt-2">
                <div className="rounded-xl border border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground text-start space-y-1.5">
                  <p className="font-semibold text-foreground">💡 ماذا سيحدث بعد الموافقة؟</p>
                  <p>1. ستتلقى إشعاراً فورياً على جهازك بالموافقة.</p>
                  <p>2. ستدخل لربط بيانات موقع الزهراء الرسمي لمرة واحدة وبأمان تام.</p>
                  <p>3. ستصلك الإشعارات اليومية الساعة 4:00 عصراً لحجز الوجبات تلقائياً.</p>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3 pt-2">
                <Link href="/pending" className="w-full">
                  <Button variant="outline" className="w-full gap-2 rounded-xl">
                    <RefreshCw className="h-4 w-4" />
                    تحديث الحالة
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </DottedTrailCursor>
      </main>
    </div>
  );
}
