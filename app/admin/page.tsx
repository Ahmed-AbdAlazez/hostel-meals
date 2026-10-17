import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AdminView } from "./admin-view";
import { Navbar } from "@/components/navbar";

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const adminEmail = process.env.ADMIN_EMAIL || "";
  const adminEmails = adminEmail.split(",").map((e) => e.trim().toLowerCase());
  const isMatch =
    user.role === "admin" ||
    adminEmails.includes(user.email.toLowerCase());

  if (!isMatch) {
    redirect("/dashboard");
  }

  const sql = getDb();

  // 1. Fetch all student profiles
  const students = await sql`
    SELECT id, full_name, email, role, approval_status, is_active, credentials_invalid, created_at
    FROM profiles
    WHERE role = 'student'
    ORDER BY created_at DESC
  `;

  // 2. Fetch recent booking requests to map last booking and last error
  const bookingRequests = await sql`
    SELECT user_id, target_date, status, chosen_meals, result_message, created_at
    FROM booking_requests
    ORDER BY target_date DESC
  `;

  // Group booking requests by user_id
  const userBookingsMap: Record<
    string,
    { lastBooking?: string; lastError?: string }
  > = {};

  if (bookingRequests) {
    for (const req of bookingRequests) {
      const uId = req.user_id as string;
      if (!userBookingsMap[uId]) {
        userBookingsMap[uId] = {};
      }
      const entry = userBookingsMap[uId];
      const targetDateStr = typeof req.target_date === "object"
        ? (req.target_date as Date).toISOString().split("T")[0]
        : (req.target_date as string);

      if (req.status === "booked" && !entry.lastBooking) {
        entry.lastBooking = `${targetDateStr} (${(req.chosen_meals as string[])?.join(" + ") || "حجز"})`;
      }
      if (req.status === "failed" && !entry.lastError) {
        entry.lastError = (req.result_message as string) || "فشل غير محدد";
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar user={{ email: user.email, full_name: "مدير النظام" }} isAdmin={true} />

      <AdminView
        students={(students as unknown as AdminStudent[]) || []}
        userBookingsMap={userBookingsMap}
        adminEmail={adminEmail || user.email}
      />
    </div>
  );
}

interface AdminStudent {
  id: string;
  full_name: string;
  email: string;
  role: string;
  approval_status: string;
  is_active: boolean;
  credentials_invalid: boolean;
  created_at: string;
}
