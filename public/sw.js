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

  const choices = {
    book_both: "both",
    book_lunch: "lunch",
    book_dinner: "dinner",
    skip: "skip",
  };
  const choice = choices[action];

  if (choice) {
    if (!data.token) {
      event.waitUntil(
        self.registration.showNotification("تعذر تنفيذ الاختيار", {
          body: "رابط الحجز غير موجود. افتح التطبيق لاختيار الوجبات.",
          icon: "/icons/icon-192.png",
          dir: "rtl",
          lang: "ar",
        })
      );
      return;
    }

    event.waitUntil(
      (async () => {
        try {
          const response = await fetch("/api/book/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: data.token, choice }),
          });
          const result = await response.json();
          const succeeded = response.ok && result.success === true;

          await self.registration.showNotification(
            succeeded ? "تم تنفيذ اختيارك ✓" : "تعذر تنفيذ الاختيار ❌",
            {
              body: result.message || "افتح التطبيق للتحقق من حالة حجزك.",
              icon: "/icons/icon-192.png",
              badge: "/icons/badge-72.png",
              dir: "rtl",
              lang: "ar",
            }
          );
        } catch {
          await self.registration.showNotification("فشل الاتصال ❌", {
            body: "تعذر الاتصال بالخادم لإتمام الاختيار، افتح التطبيق للتحقق أو المحاولة.",
            icon: "/icons/icon-192.png",
            dir: "rtl",
            lang: "ar",
          });
        }
      })()
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
