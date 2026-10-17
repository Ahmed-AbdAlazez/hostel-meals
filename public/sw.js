// Service Worker for Al-Zahraa Meal Booking Assistant
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || "حجز وجبات سكن الزهراء 🍽";
    const options = {
      body: data.body || "يرجى تحديد اختيارك لوجبات الغد قبل الساعة 8 مساءً",
      icon: data.icon || "/icons/icon-192.png",
      badge: data.badge || "/icons/badge-72.png",
      data: data.data || {},
      dir: "rtl",
      lang: "ar",
      vibrate: [200, 100, 200],
      actions: data.actions || [],
      requireInteraction: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("Push parse error:", err);
  }
});

// Handle notification actions (clicks)
self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  // Action button: "غداء + عشاء"
  if (action === "book_both") {
    if (!data.token) return;

    event.waitUntil(
      fetch("/api/book/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: data.token,
          choice: "both",
        }),
      })
        .then((res) => res.json())
        .then((resData) => {
          const success = resData.success;
          return self.registration.showNotification(
            success ? "تأكيد الحجز ✓" : "فشل الحجز ❌",
            {
              body: resData.message || (success ? "تم حجز غداء + عشاء بنجاح" : "حدث خطأ أثناء الحجز"),
              icon: "/icons/icon-192.png",
              badge: "/icons/badge-72.png",
              dir: "rtl",
              lang: "ar",
            }
          );
        })
        .catch(() => {
          return self.registration.showNotification("فشل الاتصال ❌", {
            body: "تعذر الاتصال بالخادم لإتمام الحجز، افتح التطبيق للمحاولة.",
            icon: "/icons/icon-192.png",
            dir: "rtl",
          });
        })
    );
    return;
  }

  // Action button: "لا" (skip)
  if (action === "skip") {
    if (!data.token) return;

    event.waitUntil(
      fetch("/api/book/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: data.token,
          choice: "skip",
        }),
      })
        .then((res) => res.json())
        .then(() => {
          return self.registration.showNotification("تم التخطي", {
            body: "تم اختيار عدم الحجز لوجبات الغد.",
            icon: "/icons/icon-192.png",
            dir: "rtl",
            lang: "ar",
          });
        })
    );
    return;
  }

  // If clicked body of notification: open dashboard
  const targetUrl = data.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/dashboard") && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
