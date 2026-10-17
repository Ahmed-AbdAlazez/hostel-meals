import webpush from "web-push";
import { getDb } from "./db";

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    url?: string;
    token?: string;
    targetDate?: string;
    type?:
      | "booking_prompt"
      | "booking_result"
      | "credentials_invalid"
      | "admin_alert"
      | "test";
    [key: string]: unknown;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

function initWebPush() {
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@elzahraa-app.local";
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  }
}

/**
 * Sends a push notification to all subscriptions of a specific user.
 * Prunes expired subscriptions (HTTP 404 or 410).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  initWebPush();
  const sql = getDb();

  const subscriptions = await sql`
    SELECT id, endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE user_id = ${userId}
  `;

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];

  const promises = subscriptions.map(async (sub) => {
    const pushSubscription = {
      endpoint: sub.endpoint as string,
      keys: {
        p256dh: sub.p256dh as string,
        auth: sub.auth as string,
      },
    };

    try {
      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify({
          icon: "/icons/icon-192.png",
          badge: "/icons/badge-72.png",
          dir: "rtl",
          lang: "ar",
          vibrate: [200, 100, 200],
          ...payload,
        })
      );
      sent++;
    } catch (err: unknown) {
      failed++;
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        expiredIds.push(sub.id as string);
      }
    }
  });

  await Promise.all(promises);

  // Remove pruned expired subscriptions
  if (expiredIds.length > 0) {
    await sql`
      DELETE FROM push_subscriptions
      WHERE id = ANY(${expiredIds})
    `;
  }

  return { sent, failed };
}

/**
 * Sends a push notification to the configured admin user.
 */
export async function sendPushToAdmin(
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { sent: 0, failed: 0 };

  const sql = getDb();
  const rows = await sql`
    SELECT id
    FROM profiles
    WHERE email = ${adminEmail}
    LIMIT 1
  `;

  if (!rows || rows.length === 0) return { sent: 0, failed: 0 };

  return sendPushToUser(rows[0].id as string, payload);
}
