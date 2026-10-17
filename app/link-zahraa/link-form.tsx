"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { linkZahraaAccount } from "@/app/actions/zahraa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck, AlertTriangle, KeyRound, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

export function LinkZahraaForm({
  studentName,
  isInvalid = false,
}: {
  studentName: string;
  isInvalid?: boolean;
}) {
  const router = useRouter();
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (nationalId.trim().length !== 14) {
      toast.error("الرقم القومي يجب أن يتكون من 14 رقماً بالضبط");
      return;
    }

    if (!password) {
      toast.error("يرجى إدخال كلمة مرور موقع الزهراء");
      return;
    }

    setLoading(true);
    try {
      const res = await linkZahraaAccount({
        nationalId: nationalId.trim(),
        password,
      });

      if (!res.success) {
        toast.error(res.message);
        setLoading(false);
        return;
      }

      toast.success(res.message);
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("حدث خطأ أثناء الاتصال بالخادم، يرجى المحاولة ثانية");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/80 bg-card/90 shadow-2xl backdrop-blur-xl">
      <CardHeader className="text-center space-y-2 pb-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-md">
          <KeyRound className="h-7 w-7" />
        </div>
        <CardTitle className="text-2xl font-bold">ربط حساب الزهراء</CardTitle>
        <CardDescription>
          أهلاً {studentName}، أدخل بياناتك الرسمية في موقع الزهراء لنتمكن من الحجز نيابة عنك
        </CardDescription>
      </CardHeader>

      {isInvalid && (
        <div className="mx-6 mb-2 flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive text-start">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">بيانات الزهراء السابقة غير صحيحة ⚠️</p>
            <p className="mt-0.5">
              فشل تسجيل الدخول للزهراء بكلمة المرور القديمة، يرجى إدخال البيانات المحدثة لتفعيل الحجز.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nationalId">الرقم القومي (14 رقم)</Label>
            <Input
              id="nationalId"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={14}
              placeholder="29901010123456"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              required
              dir="ltr"
              className="text-left font-mono tracking-wider"
            />
            <p className="text-[11px] text-muted-foreground text-start">
              الرقم القومي المسجل به في موقع سكن الزهراء (hostel.cu.edu.eg)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="zahraaPassword">كلمة مرور موقع الزهراء</Label>
            <Input
              id="zahraaPassword"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              dir="ltr"
              className="text-left"
            />
            <p className="text-[11px] text-muted-foreground text-start">
              كلمة السر التي تستخدمها لتسجيل الدخول على موقع الزهراء
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/40 p-3.5 text-xs text-muted-foreground text-start space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>حماية وتشفير عسكري AES-256</span>
            </div>
            <p>
              يتم فحص البيانات وتسجيل دخول فعلي على الزهراء للتأكد منها قبل حفظها، وتُشفر فورياً ولا يتم تخزينها كنص صريح أبداً.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-2">
          <Button
            type="submit"
            variant="gradient"
            className="w-full text-base font-bold shadow-md min-h-[48px]"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>جارٍ الاتصال بالزهراء والتحقق...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-5 w-5" />
                <span>اختبار وحفظ البيانات</span>
              </>
            )}
          </Button>

          <Link href="/dashboard" className="w-full">
            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs text-muted-foreground"
            >
              العودة للوحة التحكم
            </Button>
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
