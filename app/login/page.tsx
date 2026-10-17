"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DottedTrailCursor from "@/components/ui/dotted-trail-cursor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { loginAction } from "@/app/actions/auth";
import { toast } from "sonner";
import { Utensils, LogIn, Loader2 } from "lucide-react";
import { Navbar } from "@/components/navbar";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    setLoading(true);
    try {
      const res = await loginAction({
        email: email.trim(),
        password,
      });

      if (!res.success) {
        toast.error(res.message);
        setLoading(false);
        return;
      }

      toast.success("تم تسجيل الدخول بنجاح ✓");

      if (res.role === "admin") {
        router.push("/admin");
        return;
      }

      if (res.approvalStatus === "pending" || res.approvalStatus === "rejected") {
        router.push("/pending");
        return;
      }

      if (!res.hasCredentials) {
        router.push("/link-zahraa");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } catch {
      toast.error("حدث خطأ أثناء تسجيل الدخول، يرجى المحاولة ثانية");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 relative">
        <DottedTrailCursor
          colorA="#f59e0b"
          colorB="#f43f5e"
          headRadius={70}
          className="!min-h-[calc(100vh-4rem)] !h-auto flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md my-8">
            <Card className="border-border/80 bg-card/90 shadow-2xl backdrop-blur-xl">
              <CardHeader className="text-center space-y-2 pb-6">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-md">
                  <Utensils className="h-7 w-7" />
                </div>
                <CardTitle className="text-2xl font-bold">تسجيل الدخول</CardTitle>
                <CardDescription>
                  أهلاً بك مجدداً في مساعد حجز وجبات سكن الزهراء
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="student@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      dir="ltr"
                      className="text-left"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">كلمة المرور (تطبيق المساعد)</Label>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      dir="ltr"
                      className="text-left"
                    />
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-4 pt-2">
                  <Button
                    type="submit"
                    variant="gradient"
                    className="w-full text-base font-bold shadow-md"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>جارٍ التحقق...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="h-5 w-5" />
                        <span>دخول الحساب</span>
                      </>
                    )}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    ليس لديك حساب؟{" "}
                    <Link
                      href="/register"
                      className="font-bold text-primary hover:underline"
                    >
                      تسجيل طالب جديد
                    </Link>
                  </p>
                </CardFooter>
              </form>
            </Card>
          </div>
        </DottedTrailCursor>
      </main>
    </div>
  );
}
