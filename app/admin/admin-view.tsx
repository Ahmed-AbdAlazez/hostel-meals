"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminApproveStudent,
  adminRejectStudent,
  adminTogglePause,
  adminDeleteStudent,
  adminRevealPassword,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Shield,
  UserCheck,
  UserX,
  Users,
  Eye,
  Trash2,
  Pause,
  Play,
  Loader2,
  BellRing,
  Clock,
  AlertTriangle,
  KeyRound,
  CheckCircle2,
} from "lucide-react";

interface Student {
  id: string;
  full_name: string;
  email: string;
  role: string;
  approval_status: string;
  is_active: boolean;
  credentials_invalid: boolean;
  created_at: string;
}

interface AdminViewProps {
  students: Student[];
  userBookingsMap: Record<string, { lastBooking?: string; lastError?: string }>;
  adminEmail: string;
}

export function AdminView({
  students,
  userBookingsMap,
  adminEmail,
}: AdminViewProps) {
  const router = useRouter();
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [testPushLoading, setTestPushLoading] = useState(false);

  // Password reveal modal state
  const [revealModal, setRevealModal] = useState<{
    open: boolean;
    studentName: string;
    nationalId?: string;
    password?: string;
  }>({
    open: false,
    studentName: "",
  });

  // Delete student confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    student: Student | null;
  }>({
    open: false,
    student: null,
  });

  const pendingStudents = students.filter((s) => s.approval_status === "pending");
  const approvedStudents = students.filter((s) => s.approval_status === "approved");

  // Approval handler
  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await adminApproveStudent(id);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("فشل تنفيذ الإجراء");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Rejection handler
  const handleReject = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await adminRejectStudent(id);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("فشل تنفيذ الإجراء");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Pause / Resume handler
  const handleTogglePause = async (id: string, currentActive: boolean) => {
    setActionLoadingId(id);
    try {
      const res = await adminTogglePause(id, !currentActive);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("فشل تغيير الحالة");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reveal password handler
  const handleRevealPassword = async (student: Student) => {
    setActionLoadingId(student.id);
    try {
      const res = await adminRevealPassword(student.id);
      if (res.success) {
        setRevealModal({
          open: true,
          studentName: student.full_name,
          nationalId: res.nationalId,
          password: res.password,
        });
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("فشل كشف كلمة المرور");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete student handler
  const handleDeleteStudent = async () => {
    if (!deleteConfirm.student) return;
    const id = deleteConfirm.student.id;
    setActionLoadingId(id);
    try {
      const res = await adminDeleteStudent(id);
      if (res.success) {
        toast.success(res.message);
        setDeleteConfirm({ open: false, student: null });
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("فشل حذف الطالب");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Test admin push notification
  const handleTestAdminPush = async () => {
    setTestPushLoading(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("تم إرسال إشعار تجريبي للأدمن بنجاح 🔔");
      } else {
        toast.error(data.message || "فشل إرسال الإشعار، تأكد من تفعيل الإشعارات في المتصفح");
      }
    } catch {
      toast.error("خطأ أثناء الاتصال بالخادم");
    } finally {
      setTestPushLoading(false);
    }
  };

  return (
    <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 max-w-5xl space-y-8">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">لوحة إدارة النظام</h1>
              <p className="text-xs text-muted-foreground">{adminEmail}</p>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={handleTestAdminPush}
          disabled={testPushLoading}
          className="rounded-xl gap-2 font-medium"
        >
          {testPushLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <BellRing className="h-4 w-4 text-amber-500" />
          )}
          إرسال إشعار تجريبي للأدمن
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-card/90">
          <p className="text-xs text-muted-foreground">إجمالي الطلاب</p>
          <p className="text-2xl font-bold text-foreground mt-1">{students.length}</p>
        </Card>
        <Card className="p-4 bg-card/90">
          <p className="text-xs text-muted-foreground">طلبات في الانتظار</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {pendingStudents.length}
          </p>
        </Card>
        <Card className="p-4 bg-card/90">
          <p className="text-xs text-muted-foreground">طلاب نشطون</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {approvedStudents.filter((s) => s.is_active).length}
          </p>
        </Card>
        <Card className="p-4 bg-card/90">
          <p className="text-xs text-muted-foreground">في وضع الإجازة</p>
          <p className="text-2xl font-bold text-muted-foreground mt-1">
            {approvedStudents.filter((s) => !s.is_active).length}
          </p>
        </Card>
      </div>

      {/* 1. Pending Approvals Section */}
      <Card className="border-border/80 bg-card/90 shadow-md">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg font-bold">
              طلبات الانضمام الجديدة ({pendingStudents.length})
            </CardTitle>
          </div>
          <CardDescription>
            الطلاب المسجلون الجدد بانتظار موافقة الأدمن لتفعيل حساباتهم
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          {pendingStudents.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              لا توجد طلبات جديدة معلقة حالياً ✓
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {pendingStudents.map((student) => (
                <div
                  key={student.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-start"
                >
                  <div>
                    <p className="font-bold text-foreground text-sm">{student.full_name}</p>
                    <p className="text-xs text-muted-foreground">{student.email}</p>
                    <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                      تاريخ التسجيل: {new Date(student.created_at).toLocaleDateString("ar-EG")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="gradient"
                      className="rounded-xl gap-1.5 h-9"
                      disabled={actionLoadingId === student.id}
                      onClick={() => handleApprove(student.id)}
                    >
                      {actionLoadingId === student.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                      قبول الطالب
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl gap-1.5 h-9 text-destructive hover:bg-destructive/10"
                      disabled={actionLoadingId === student.id}
                      onClick={() => handleReject(student.id)}
                    >
                      <UserX className="h-4 w-4" />
                      رفض
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. All Students Management Table */}
      <Card className="border-border/80 bg-card/90 shadow-md">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">قائمة الطلاب المسجلين</CardTitle>
          </div>
          <CardDescription>
            إدارة حسابات الطلاب، المتابعة، والاطلاع على بيانات الاعتماد
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 p-0 sm:p-6 overflow-x-auto">
          {students.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              لا يوجد طلاب مسجلون بعد
            </div>
          ) : (
            <div className="min-w-[650px]">
              <table className="w-full text-start text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground text-xs">
                    <th className="pb-3 text-start font-semibold">الطالب</th>
                    <th className="pb-3 text-start font-semibold">الحالة</th>
                    <th className="pb-3 text-start font-semibold">آخر حجز</th>
                    <th className="pb-3 text-start font-semibold">آخر خطأ</th>
                    <th className="pb-3 text-start font-semibold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {students.map((student) => {
                    const bookingInfo = userBookingsMap[student.id];
                    return (
                      <tr key={student.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-4 text-start">
                          <p className="font-bold text-foreground">{student.full_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{student.email}</p>
                        </td>

                        <td className="py-4 text-start">
                          {student.approval_status === "pending" ? (
                            <Badge variant="warning">في الانتظار</Badge>
                          ) : student.approval_status === "rejected" ? (
                            <Badge variant="destructive">مرفوض</Badge>
                          ) : student.credentials_invalid ? (
                            <Badge variant="destructive">بيانات الزهراء غلط</Badge>
                          ) : student.is_active ? (
                            <Badge variant="success">نشط</Badge>
                          ) : (
                            <Badge variant="outline">متوقف (إجازة)</Badge>
                          )}
                        </td>

                        <td className="py-4 text-start text-xs text-muted-foreground">
                          {bookingInfo?.lastBooking || "—"}
                        </td>

                        <td className="py-4 text-start text-xs text-destructive max-w-[150px] truncate" title={bookingInfo?.lastError}>
                          {bookingInfo?.lastError || "—"}
                        </td>

                        <td className="py-4 text-start">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Reveal Al-Zahraa Password button */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg text-xs gap-1 border-amber-500/30 text-amber-700 dark:text-amber-400"
                              title="إظهار باسورد الزهراء"
                              disabled={actionLoadingId === student.id}
                              onClick={() => handleRevealPassword(student)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              باسورد الزهراء
                            </Button>

                            {/* Pause / Resume Button */}
                            {student.approval_status === "approved" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 rounded-lg"
                                title={student.is_active ? "إيقاف مؤقت" : "تنشيط"}
                                disabled={actionLoadingId === student.id}
                                onClick={() => handleTogglePause(student.id, student.is_active)}
                              >
                                {student.is_active ? (
                                  <Pause className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Play className="h-4 w-4 text-emerald-500" />
                                )}
                              </Button>
                            )}

                            {/* Delete Button */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 rounded-lg text-destructive hover:bg-destructive/10"
                              title="حذف الطالب نهائياً"
                              disabled={actionLoadingId === student.id}
                              onClick={() => setDeleteConfirm({ open: true, student })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revealed Password Dialog (Unlogged, in-memory decrypt) */}
      <Dialog
        open={revealModal.open}
        onOpenChange={(open) =>
          setRevealModal((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 mb-2">
              <KeyRound className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center font-bold text-lg">
              بيانات حساب الزهراء ({revealModal.studentName})
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              تم فك تشفير البيانات من قاعدة البيانات بناءً على طلبك كمدير للنظام فقط.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="p-3 rounded-xl border border-border/60 bg-muted/40 space-y-1 text-start">
              <span className="text-xs text-muted-foreground font-semibold">الرقم القومي:</span>
              <p className="font-mono text-base font-bold text-foreground select-all">
                {revealModal.nationalId || "غير متوفر"}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-border/60 bg-muted/40 space-y-1 text-start">
              <span className="text-xs text-muted-foreground font-semibold">كلمة مرور الزهراء:</span>
              <p className="font-mono text-base font-bold text-primary select-all">
                {revealModal.password || "غير متوفر"}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              className="w-full rounded-xl"
              onClick={() => setRevealModal({ open: false, studentName: "" })}
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Student Confirmation Dialog */}
      <Dialog
        open={deleteConfirm.open}
        onOpenChange={(open) =>
          setDeleteConfirm((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center font-bold text-lg text-destructive">
              حذف حساب الطالب نهائياً
            </DialogTitle>
            <DialogDescription className="text-center text-sm leading-relaxed pt-2">
              هل أنت متأكد من حذف حساب الطالب{" "}
              <strong>{deleteConfirm.student?.full_name}</strong>؟
              <br />
              سيتم حذف بياناته المشفرة وسجلات الحجز واشتراكات الإشعارات نهائياً.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              className="w-full sm:w-auto font-bold rounded-xl"
              onClick={handleDeleteStudent}
            >
              نعم، حذف الحساب
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto rounded-xl"
              onClick={() => setDeleteConfirm({ open: false, student: null })}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
