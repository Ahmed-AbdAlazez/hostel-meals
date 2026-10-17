"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DottedTrailCursor from "@/components/ui/dotted-trail-cursor";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toggleActiveStatus, deleteAccount, bookFromDashboardAction } from "@/app/actions/zahraa";
import { formatArabicDate } from "@/lib/time";
import { toast } from "sonner";
import {
  Utensils,
  Calendar,
  Bell,
  BellRing,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  KeyRound,
  Trash2,
  Loader2,
  RefreshCw,
  Info,
  Smartphone,
} from "lucide-react";

interface DashboardViewProps {
  profile: {
    id: string;
    full_name: string;
    email: string;
    is_active: boolean;
    credentials_invalid: boolean;
  };
  hasCredentials: boolean;
  tomorrowDateStr: string;
  tomorrowArabic: string;
  isPast8Pm: boolean;
  isAfter4Pm: boolean;
  tomorrowRequest: {
    id: string;
    status: string;
    chosen_meals: string[];
    result_message?: string;
    token_hash?: string;
  } | null;
  lastRequest: {
    target_date: string;
    status: string;
    chosen_meals: string[];
    result_message?: string;
  } | null;
}

export function DashboardView({
  profile,
  hasCredentials,
  tomorrowDateStr,
  tomorrowArabic,
  isPast8Pm,
  isAfter4Pm,
  tomorrowRequest,
  lastRequest,
}: DashboardViewProps) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(profile.is_active);
  const [activeToggleLoading, setActiveToggleLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState<"default" | "granted" | "denied" | "unsupported">("default");
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    choice: "both" | "lunch" | "dinner" | "skip" | null;
    label: string;
  }>({
    open: false,
    choice: null,
    label: "",
  });

  // Delete account dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Check notification permission and platform on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const userAgent = window.navigator.userAgent.toLowerCase();
      setIsIos(/iphone|ipad|ipod/.test(userAgent));
      setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);

      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setPushStatus("unsupported");
      } else {
        setPushStatus(Notification.permission as "default" | "granted" | "denied");
      }

      // Register service worker if supported
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch((err) => {
          console.warn("Service worker registration error:", err);
        });
      }
    }
  }, []);

  // Vacation / Active toggle handler
  const handleToggleActive = async (checked: boolean) => {
    if (!hasCredentials && checked) {
      toast.error("يرجى ربط بيانات حساب الزهراء أولاً قبل تفعيل الحساب");
      return;
    }

    setActiveToggleLoading(true);
    setIsActive(checked);
    try {
      const res = await toggleActiveStatus(checked);
      if (res.success) {
        toast.success(res.message);
      } else {
        setIsActive(!checked);
        toast.error(res.message);
      }
    } catch {
      setIsActive(!checked);
      toast.error("فشل تغيير الحالة");
    } finally {
      setActiveToggleLoading(false);
      router.refresh();
    }
  };

  // Web Push Subscription handler
  const handleEnablePush = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      toast.error("المتصفح الحالي لا يدعم إشعارات Web Push");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPushStatus(permission as "default" | "granted" | "denied");

      if (permission !== "granted") {
        toast.error("تم رفض إذن الإشعارات من المتصفح");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        toast.error("مفتاح VAPID غير معرف في إعدادات التطبيق");
        return;
      }

      // Helper to convert base64 to Uint8Array for pushManager
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const jsonSub = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: jsonSub.keys?.p256dh,
            auth: jsonSub.keys?.auth,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("تم تفعيل الإشعارات بنجاح ✓");
      } else {
        toast.error(data.error || "فشل حفظ بيانات الاشتراك");
      }
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء تفعيل الإشعارات");
    }
  };

  // Test Push notification
  const handleTestPush = async () => {
    setTestPushLoading(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message || data.error || "فشل إرسال الإشعار");
      }
    } catch {
      toast.error("خطأ أثناء الاتصال بالخادم");
    } finally {
      setTestPushLoading(false);
    }
  };

  // Direct Booking Action from Dashboard
  const handleBookingChoice = async (choice: "both" | "lunch" | "dinner" | "skip") => {
    setConfirmDialog({ open: false, choice: null, label: "" });
    setActionLoading(true);

    try {
      const res = await bookFromDashboardAction(choice);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setActionLoading(false);
      router.refresh();
    }
  };

  // Account deletion handler
  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      const res = await deleteAccount();
      if (res.success) {
        toast.success(res.message);
        router.push("/login");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("فشل حذف الحساب");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Determine current status of tomorrow's booking
  const reqStatus = tomorrowRequest?.status;

  return (
    <main className="flex-1 relative">
      {/* Subtle DottedTrailCursor background for dashboard */}
      <DottedTrailCursor
        colorA="#f59e0b"
        colorB="#f43f5e"
        headRadius={40}
        glowRadius={180}
        trailLength={12}
        className="!min-h-[calc(100vh-4rem)] !h-auto py-6 sm:py-10"
      >
        <div className="container mx-auto px-4 sm:px-6 max-w-3xl space-y-6">
          {/* Top Welcome & Vacation Switch */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card/90 p-5 shadow-sm backdrop-blur-md">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                مرحباً {profile.full_name} 👋
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                حالة الحساب والمتابعة اليومية لوجبات سكن الزهراء
              </p>
            </div>

            {/* Vacation Mode Toggle */}
            <div className="flex items-center gap-3 bg-muted/50 p-2.5 rounded-xl border border-border/60">
              <div className="flex flex-col text-start">
                <span className="text-xs font-bold text-foreground">
                  {isActive ? "الحساب نَشِط" : "وضع الإجازة"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {isActive ? "يستقبل الإشعارات والحجز" : "متوقف مؤقتاً"}
                </span>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={handleToggleActive}
                disabled={activeToggleLoading}
                aria-label="تفعيل أو إيقاف الحساب"
              />
            </div>
          </div>

          {/* Red Banner: Invalid Credentials */}
          {profile.credentials_invalid && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-destructive shadow-sm">
              <div className="flex items-start gap-3 text-start">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">بيانات الزهراء غلط، يرجى تحديثها فوراً ⚠️</p>
                  <p className="text-xs mt-0.5 opacity-90">
                    فشل تسجيل الدخول للزهراء بكلمة المرور الحالية. تم إيقاف الحساب مؤقتاً لتجنب إغلاقه.
                  </p>
                </div>
              </div>
              <Link href="/link-zahraa" className="w-full sm:w-auto shrink-0">
                <Button size="sm" variant="destructive" className="w-full sm:w-auto rounded-xl gap-1.5 font-bold">
                  <KeyRound className="h-4 w-4" />
                  تحديث البيانات
                </Button>
              </Link>
            </div>
          )}

          {/* Missing Credentials Warning */}
          {!hasCredentials && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-300 shadow-sm">
              <div className="flex items-start gap-3 text-start">
                <Info className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">حساب الزهراء غير مربوط بعد</p>
                  <p className="text-xs mt-0.5 opacity-90">
                    اربط رقمك القومي وكلمة مرور موقع الزهراء للبدء في حجز الوجبات تلقائياً.
                  </p>
                </div>
              </div>
              <Link href="/link-zahraa" className="w-full sm:w-auto shrink-0">
                <Button size="sm" variant="gradient" className="w-full sm:w-auto rounded-xl gap-1.5 font-bold">
                  <KeyRound className="h-4 w-4" />
                  ربط الحساب الآن
                </Button>
              </Link>
            </div>
          )}

          {/* Main Booking Card for Tomorrow */}
          <Card className="border-border/80 bg-card/90 shadow-xl backdrop-blur-md overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">حجز وجبات الغد</CardTitle>
                    <CardDescription className="text-xs">
                      {tomorrowArabic}
                    </CardDescription>
                  </div>
                </div>

                {/* Status Badges */}
                <div>
                  {!isActive ? (
                    <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                      في إجازة
                    </Badge>
                  ) : reqStatus === "booked" ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      تم الحجز ✓
                    </Badge>
                  ) : reqStatus === "skipped" ? (
                    <Badge variant="secondary">تم التخطي</Badge>
                  ) : reqStatus === "failed" ? (
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="h-3 w-3" />
                      فشل الحجز
                    </Badge>
                  ) : reqStatus === "no_meals" ? (
                    <Badge variant="outline">لا توجد وجبات</Badge>
                  ) : reqStatus === "already_booked" ? (
                    <Badge variant="success">محجوز مسبقاً</Badge>
                  ) : isPast8Pm ? (
                    <Badge variant="outline" className="text-muted-foreground">مغلق (بعد 8:00 م)</Badge>
                  ) : (
                    <Badge variant="warning" className="gap-1">
                      <Clock className="h-3 w-3" />
                      متاح قبل 8:00 م
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {/* Dynamic Content based on State */}
              {!isActive ? (
                <div className="py-6 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Clock className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-foreground">الحساب متوقف حالياً (وضع الإجازة)</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    لن يتم إرسال إشعارات أو حجز وجبات لك غداً. قم بتفعيل المفتاح بأعلى الصفحة عند عودتك للسكن.
                  </p>
                </div>
              ) : reqStatus === "booked" ? (
                <div className="py-6 text-center space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">تم حجز وجباتك بنجاح في الزهراء ✓</h3>
                  <p className="text-sm text-muted-foreground">
                    الوجبات المحجوزة:{" "}
                    <strong className="text-foreground">
                      {tomorrowRequest?.chosen_meals?.join(" + ") || "غداء + عشاء"}
                    </strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tomorrowRequest?.result_message || "تم التحقق من ظهور الحجز بجدول الوجبات الرسمي."}
                  </p>
                </div>
              ) : reqStatus === "skipped" ? (
                <div className="py-6 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Info className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-foreground">تم اختيار عدم حجز وجبات الغد</h3>
                  <p className="text-xs text-muted-foreground">
                    لن يقوم المساعد بأي حجز ليوم {tomorrowArabic}.
                  </p>
                </div>
              ) : reqStatus === "no_meals" ? (
                <div className="py-6 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Utensils className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-foreground">لا توجد وجبات متاحة للحجز</h3>
                  <p className="text-xs text-muted-foreground">
                    موقع الزهراء لم يدرج وجبات متاحة للحجز ليوم {tomorrowArabic}.
                  </p>
                </div>
              ) : reqStatus === "already_booked" ? (
                <div className="py-6 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-foreground">الوجبات محجوزة بالفعل ليوم الغد</h3>
                  <p className="text-xs text-muted-foreground">
                    وجد النظام أنك قمت بحجز وجبات الغد مسبقاً في موقع الزهراء، ولم نقم بتغييرها.
                  </p>
                </div>
              ) : isPast8Pm ? (
                <div className="py-6 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Clock className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-foreground">انتهى موعد الحجز اليومي (الساعة 8:00 مساءً)</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    طبقاً لقواعد سكن الزهراء بجامعة القاهرة، يُقفل حجز وجبات الغد تمام الساعة 8 مساءً القاهرة.
                  </p>
                </div>
              ) : (
                /* Interactive booking choice buttons */
                <div className="space-y-4">
                  {reqStatus === "failed" && (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive text-start flex items-center justify-between gap-2">
                      <span>فشل الحجز السابق: {tomorrowRequest?.result_message || "تعذر الاتصال"}</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 rounded-lg text-xs"
                        onClick={() =>
                          setConfirmDialog({
                            open: true,
                            choice: "both",
                            label: "غداء + عشاء",
                          })
                        }
                      >
                        إعادة المحاولة
                      </Button>
                    </div>
                  )}

                  {!isAfter4Pm && reqStatus !== "asked" && (
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground text-start flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span>
                        يبدأ موعد الحجز الرسمي الساعة 4:00 عصراً، ولكن يمكنك تحديد اختيارك الآن مسبقاً:
                      </span>
                    </div>
                  )}

                  <p className="text-xs font-semibold text-muted-foreground text-start">
                    اختر ما تريد حجزه ليوم {tomorrowArabic} (لا يمكن التعديل بعد الحفظ):
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      variant="gradient"
                      size="lg"
                      className="gap-2 font-bold shadow-md h-14"
                      disabled={actionLoading || !hasCredentials}
                      onClick={() =>
                        setConfirmDialog({
                          open: true,
                          choice: "both",
                          label: "غداء + عشاء",
                        })
                      }
                    >
                      <Sparkles className="h-5 w-5" />
                      غداء + عشاء
                    </Button>

                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2 font-semibold h-14 border-border/80"
                      disabled={actionLoading || !hasCredentials}
                      onClick={() =>
                        setConfirmDialog({
                          open: true,
                          choice: "lunch",
                          label: "غداء فقط",
                        })
                      }
                    >
                      <Utensils className="h-4 w-4 text-amber-500" />
                      غداء فقط
                    </Button>

                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2 font-semibold h-14 border-border/80"
                      disabled={actionLoading || !hasCredentials}
                      onClick={() =>
                        setConfirmDialog({
                          open: true,
                          choice: "dinner",
                          label: "عشاء فقط",
                        })
                      }
                    >
                      <Utensils className="h-4 w-4 text-rose-500" />
                      عشاء فقط
                    </Button>

                    <Button
                      variant="ghost"
                      size="lg"
                      className="gap-2 font-medium h-14 text-muted-foreground hover:text-destructive"
                      disabled={actionLoading}
                      onClick={() =>
                        setConfirmDialog({
                          open: true,
                          choice: "skip",
                          label: "لا (تخطي حجز الغد)",
                        })
                      }
                    >
                      <XCircle className="h-4 w-4" />
                      لا (تخطي)
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>

            {/* Last Booking Result Line */}
            <CardFooter className="border-t border-border/50 bg-muted/10 py-3 px-6 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-muted-foreground gap-2">
              <span className="font-semibold text-foreground">آخر حجز:</span>
              <span>
                {lastRequest ? (
                  <span>
                    حجز {formatArabicDate(lastRequest.target_date)}:{" "}
                    <strong>
                      {lastRequest.status === "booked"
                        ? `تم حجز (${lastRequest.chosen_meals?.join(" + ") || "الوجبات"}) ✓`
                        : lastRequest.status === "skipped"
                        ? "تم التخطي"
                        : lastRequest.result_message || lastRequest.status}
                    </strong>
                  </span>
                ) : (
                  "لم يتم تسجيل حجوزات سابقة بعد"
                )}
              </span>
            </CardFooter>
          </Card>

          {/* Web Push & Notification Settings Card */}
          <Card className="border-border/80 bg-card/90 shadow-sm backdrop-blur-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-base font-bold">إشعارات الحجز اليومية</CardTitle>
              </div>
              <CardDescription className="text-xs">
                إرسال تنبيه في تمام الساعة 4:00 عصراً لتأكيد حجزك بضغطة زر
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/60 bg-muted/20">
                <div className="text-start">
                  <p className="text-sm font-semibold text-foreground">
                    حالة الإشعارات:{" "}
                    {pushStatus === "granted" ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">مفعلة ✓</span>
                    ) : pushStatus === "denied" ? (
                      <span className="text-destructive font-bold">محظورة في المتصفح</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">غير مفعلة بعد</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {pushStatus === "granted"
                      ? "جهازك جاهز لاستقبال إشعارات 4:00 عصراً."
                      : "فعل الإشعارات لتصلك تنبيهات الحجز السريعة."}
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {pushStatus !== "granted" ? (
                    <Button
                      size="sm"
                      variant="gradient"
                      onClick={handleEnablePush}
                      className="w-full sm:w-auto rounded-xl gap-1.5 font-bold"
                    >
                      <Bell className="h-4 w-4" />
                      تفعيل الإشعارات
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleTestPush}
                      disabled={testPushLoading}
                      className="w-full sm:w-auto rounded-xl gap-1.5"
                    >
                      {testPushLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <BellRing className="h-4 w-4 text-amber-500" />
                      )}
                      إرسال إشعار تجريبي
                    </Button>
                  )}
                </div>
              </div>

              {/* Install PWA Hint on Android */}
              {!isStandalone && (
                <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground text-start">
                  <Smartphone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground">نصيحة لتجربة أفضل على الهاتف: </span>
                    أضف التطبيق لشاشتك الرئيسية (من قائمة خيارات المتصفح اختر "إضافة إلى الشاشة الرئيسية" أو "تثبيت التطبيق") لتصلك الإشعارات كتطبيق مستقل.
                  </div>
                </div>
              )}

              {/* iOS Note */}
              {isIos && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground text-start">
                  <span className="font-bold text-foreground">📱 تنبيه لمستخدمي iPhone:</span> تدعم شركة Apple إشعارات الويب فقط عند إضافة التطبيق للشاشة الرئيسية (عبر زر المشاركة ⎋ ثم "إضافة إلى الشاشة الرئيسية") في نظام iOS 16.4+.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Settings & Credentials Section */}
          <Card className="border-border/80 bg-card/90 shadow-sm backdrop-blur-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">إعدادات الحساب</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/10">
                <div className="text-start">
                  <p className="text-sm font-semibold text-foreground">بيانات حساب الزهراء</p>
                  <p className="text-xs text-muted-foreground">تحديث الرقم القومي أو كلمة المرور المشفرة</p>
                </div>
                <Link href="/link-zahraa">
                  <Button size="sm" variant="outline" className="rounded-xl gap-1.5">
                    <KeyRound className="h-4 w-4" />
                    تحديث
                  </Button>
                </Link>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-destructive/20 bg-destructive/5">
                <div className="text-start">
                  <p className="text-sm font-semibold text-destructive">حذف الحساب نهائياً</p>
                  <p className="text-xs text-muted-foreground">حذف جميع بيانات الدخول المشفرة والاشتراكات</p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="rounded-xl gap-1.5"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  حذف الحساب
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DottedTrailCursor>

      {/* Booking Confirmation Dialog (Irreversible Warning) */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center font-bold text-lg">
              تأكيد حجز الوجبات ⚠️
            </DialogTitle>
            <DialogDescription className="text-center text-sm leading-relaxed pt-2">
              هل أنت متأكد من رغبتك في اختيار{" "}
              <strong className="text-primary font-bold">{confirmDialog.label}</strong> ليوم{" "}
              <strong>{tomorrowArabic}</strong>؟
              <br />
              <span className="text-destructive font-semibold mt-2 block">
                تنبيه: موقع سكن الزهراء لا يتيح تعديل أو إلغاء الحجز بعد حفظه نهائياً.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
            <Button
              variant="gradient"
              className="w-full sm:w-auto font-bold rounded-xl"
              disabled={actionLoading}
              onClick={() => confirmDialog.choice && handleBookingChoice(confirmDialog.choice)}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جارٍ الحجز...
                </>
              ) : (
                "نعم، تأكيد الحجز الآن"
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto rounded-xl"
              disabled={actionLoading}
              onClick={() => setConfirmDialog({ open: false, choice: null, label: "" })}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center font-bold text-lg text-destructive">
              تأكيد حذف الحساب نهائياً
            </DialogTitle>
            <DialogDescription className="text-center text-sm leading-relaxed pt-2">
              سيتم حذف جميع بياناتك نهائياً وبشكل فوري:
              <br />
              - حذف بيانات الرقم القومي وكلمة المرور المشفرة.
              - إيقاف جميع اشتراكات الإشعارات والمهام المجدولة.
              - لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              className="w-full sm:w-auto font-bold rounded-xl"
              disabled={deleteLoading}
              onClick={handleDeleteAccount}
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جارٍ الحذف...
                </>
              ) : (
                "نعم، احذف حسابي نهائياً"
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto rounded-xl"
              disabled={deleteLoading}
              onClick={() => setDeleteDialogOpen(false)}
            >
              تراجع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
