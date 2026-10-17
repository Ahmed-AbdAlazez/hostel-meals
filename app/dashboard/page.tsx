import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getTomorrowCairoDate, formatArabicDate, isPastCairoBookingDeadline, isAtOrAfterCairoTime } from "@/lib/time";
import { DashboardView } from "./dashboard-view";
import { Navbar } from "@/components/navbar";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // If pending or rejected
  if (user.approval_status !== "approved") {
    redirect("/pending");
  }

  const sql = getDb();

  // 1. Check if Al-Zahraa credentials exist
  const credsRows = await sql`
    SELECT user_id, last_verified_at
    FROM zahraa_credentials
    WHERE user_id = ${user.id}
    LIMIT 1
  `;

  const hasCredentials = Boolean(credsRows && credsRows.length > 0);

  // 2. Get dates
  const now = new Date();
  const tomorrowDateStr = getTomorrowCairoDate(now);
  const tomorrowArabic = formatArabicDate(tomorrowDateStr);
  const isPast8Pm = isPastCairoBookingDeadline(now);
  const isAfter4Pm = isAtOrAfterCairoTime(16, 0, now);

  // 3. Fetch tomorrow's booking request
  const tomorrowRows = await sql`
    SELECT id, status, chosen_meals, result_message, token_hash
    FROM booking_requests
    WHERE user_id = ${user.id}
      AND target_date = ${tomorrowDateStr}
    LIMIT 1
  `;
  const tomorrowRequest = tomorrowRows && tomorrowRows.length > 0 ? tomorrowRows[0] : null;

  // 4. Fetch last booking request (previous history item)
  const lastRows = await sql`
    SELECT target_date, status, chosen_meals, result_message, updated_at
    FROM booking_requests
    WHERE user_id = ${user.id}
      AND target_date != ${tomorrowDateStr}
    ORDER BY target_date DESC
    LIMIT 1
  `;
  const lastRequest = lastRows && lastRows.length > 0
    ? {
        ...lastRows[0],
        target_date: typeof lastRows[0].target_date === "object"
          ? (lastRows[0].target_date as Date).toISOString().split("T")[0]
          : (lastRows[0].target_date as string),
      }
    : null;

  const adminEmail = process.env.ADMIN_EMAIL || "";
  const adminEmails = adminEmail.split(",").map((e) => e.trim().toLowerCase());
  const isAdmin =
    user.role === "admin" ||
    adminEmails.includes(user.email.toLowerCase());

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar user={user} isAdmin={Boolean(isAdmin)} />

      <DashboardView
        profile={user}
        hasCredentials={hasCredentials}
        tomorrowDateStr={tomorrowDateStr}
        tomorrowArabic={tomorrowArabic}
        isPast8Pm={isPast8Pm}
        isAfter4Pm={isAfter4Pm}
        tomorrowRequest={tomorrowRequest as unknown as DashboardViewProps["tomorrowRequest"]}
        lastRequest={lastRequest as unknown as DashboardViewProps["lastRequest"]}
      />
    </div>
  );
}

interface DashboardViewProps {
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
