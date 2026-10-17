# 🍽 مساعد حجز وجبات سكن الزهراء | جامعة القاهرة (Al-Zahraa Meal Booking Assistant)

تطبيق ويب تقدمي (Mobile-First PWA) متكامل وموجّه بالكامل باللغة العربية (RTL)، مصمم لمساعدة طلاب المدن الجامعية (سكن الزهراء - جامعة القاهرة) على حجز وجبات الغد (غداء / عشاء) تلقائياً وبأعلى معايير الأمان قبل الموعد النهائي اليومي (الساعة 8:00 مساءً بتوقيت القاهرة).

يعتمد التطبيق الآن على **Neon Postgres (Serverless Postgres)** بدلاً من Supabase، مما يضمن **عدم توقف قاعدة البيانات أو حذفها بسبب عدم الاستخدام (No Inactivity Pause)** واستيقاظها التلقائي الفوري عند كل طلب.

---

## 🌟 أبرز المميزات

1. **إشعارات Web Push ذكية على الهاتف**:
   - إشعار يومي يرسل في تمام الساعة 4:00 عصراً يسأل الطالب عن اختياره لوجبات الغد.
   - أزرار تفاعلية مباشرة داخل الإشعار للأندرويد: **"غداء + عشاء"** أو **"لا"**، ويتم الحجز في الخلفية بضغطة واحدة دون الحاجة لفتح المتصفح!
   - تذكير إضافي الساعة 6:30 مساءً لمن لم يرد بعد، وإغلاق صارم للطلبات بعد الساعة 8:00 مساءً.
2. **قاعدة بيانات Neon Serverless Postgres سريعة ودائمة**:
   - لا تتوقف بعد 7 أيام كالحسابات المجانية الأخرى.
   - استيقاظ تلقائي (`Autoresume`) خلال أجزاء من الثانية فور وصول أي استدعاء من الـ Cron أو زيارة طالب.
3. **أمان وحماية عسكرية للبيانات**:
   - تشفير الرقم القومي وكلمة مرور موقع الزهراء باستخدام خوارزمية **AES-256-GCM** مع مفتاح تشفير 32-بايت وعزل تام داخل السيرفر (Server-Only).
   - توكنات أحادية الاستخدام (Single-Use Tokens) مشفرة ومقارنة بتجزئة SHA-256 لمنع تكرار أو ازدواجية الحجز عند النقر المتكرر.
   - نظام مصادقة داخلي متقدم بدون خدمات طرف ثالث (تشفير كلمات المرور بـ `scrypt` وجلسات مشفرة بـ `HTTP-Only Cookies`).
4. **قاعدة الأمان الحرجة للربط مع الزهراء (`lib/zahraa.ts`)**:
   - أخذ اتحاد (Union) جميع الوجبات المحجوزة مسبقاً مع الوجبات الجديدة لضمان عدم حذف أو مسح أي حجز قائم.
   - فحص وتأكيد نجاح الحجز بعد الإرسال بإعادة جلب جدول الوجبات والتحقق من ظهور علامة الحجز (`booked: true`).
   - وضع تجريبي آمن `DRY_RUN=true` للتجربة واختبار المنظومة دون المساس بالحساب الحقيقي.
5. **دورة حياة الطالب وإدارة الأدمن**:
   - تسجيل الطلاب الجدد بحالة قيد المراجعة (`pending`) مع إشعار فوري للأدمن للموافقة أو الرفض.
   - كشف كلمة مرور الزهراء للأدمن عند الحاجة عبر Server Action مشفر لا يمر بأي سجلات (Unlogged In-Memory Decrypt).
   - زر تبديل وضع الإجازة ("نشط / متوقف") لإيقاف الإشعارات والحجوزات أثناء السفر أو العطلات.
   - رصد تلقائي لتغيير كلمة المرور في الزهراء، وتنبيه الطالب لإعادة إدخالها مع إيقاف الحساب لتجنب إغلاقه.
6. **تصميم عصري جذاب وخفيف**:
   - خلفية تفاعلية بمكون `DottedTrailCursor` المخصص بظلال ألوان الطعام الدافئة (Amber إلى Rose).
   - خط عربي عصري (Cairo) وتوافق تام مع الوضعين الداكن والفاتح (Dark/Light Mode).
   - تطبيق ويب تقدمي قابل للتثبيت كأيقونة على شاشة الهاتف الرئيسية (PWA).

---

## 🛠 التقنيات المستخدمة (Tech Stack)

- **Framework**: Next.js (App Router) + TypeScript + Node.js Runtime.
- **Styling**: Tailwind CSS v4 + Radix UI + Lucide Icons + Sonner Toasts.
- **Database**: Neon Postgres (`@neondatabase/serverless`).
- **Auth**: Native Scrypt Password Hashing + Signed JWT Session Cookies (`jose`).
- **Push Engine**: `web-push` (VAPID) + Service Worker (`/sw.js`).
- **Timezone**: Africa/Cairo ديناميكي بالكامل لمراعاة التوقيت الصيفي/الشتوي.

---

## 🚀 دليل التثبيت والإعداد السريع

### 1. استنساخ المشروع وتثبيت الحزم
```bash
git clone <repo-url> elzahraa
cd elzahraa
npm install
```

### 2. إعداد قاعدة بيانات Neon
1. ادخل على **[console.neon.tech](https://console.neon.tech)** وأنشئ حساباً ومشروعاً مجانياً (اختر أقرب سيرفر مثل Frankfurt - eu-central-1).
2. في لوحة التحكم، افتح تبويب **SQL Editor**.
3. انسخ محتويات ملف الترحيل الموجود في مشروعك:
   [`neon_schema.sql`](file:///c:/Users/moham/OneDrive/Desktop/elzahraa/neon_schema.sql)
4. الصقها واضغط **Run** لإنشاء الجداول والفهارس ودوال التحديث.
5. انسخ رابط الاتصال **Connection String** (يبدأ بـ `postgresql://...` مع `?sslmode=require`).

### 3. إعداد ملف البيئة `.env.local`
أنشئ ملف `.env.local` مسترشداً بملف [`.env.example`](file:///c:/Users/moham/OneDrive/Desktop/elzahraa/.env.example):

1. **رابط Neon Postgres**:
   ```env
   DATABASE_URL=postgresql://neondb_owner:npg_xxxx@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

2. **مفاتيح VAPID للإشعارات**:
   نفذ الأمر التالي في سطر الأوامر لتوليد زوج المفاتيح العام والخاص:
   ```bash
   npx web-push generate-vapid-keys
   ```
   - ضع المفتاح العام في `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
   - ضع المفتاح الخاص في `VAPID_PRIVATE_KEY`.

3. **مفتاح تشفير بيانات الاعتماد `ENCRYPTION_KEY` (32 بايت Base64)**:
   - على أنظمة Linux/Mac/Git Bash:
     ```bash
     openssl rand -base64 32
     ```
   - على Windows PowerShell:
     ```powershell
     [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
     ```

4. **سر الجدولة `CRON_SECRET`**:
   اختر كلمة سر عشوائية قوية لحماية نقطة النهاية `/api/cron/tick`.

5. **بريد مدير النظام `ADMIN_EMAIL`**:
   البريد الإلكتروني الذي ستسجل به ليكون حساب الأدمن الأساسي.

6. **الوضع التجريبي `DRY_RUN`**:
   اضبطه على `true` أثناء الاختبار والتجربة.

---

## ⏰ إعداد الجدولة التلقائية الخارجية (Cron Job)

نقطة النهاية الشاملة:
`GET /api/cron/tick`

قم بإعداد أداة مجدولة خارجية مجانية مثل [cron-job.org](https://cron-job.org) لطلب الرابط كل **5 دقائق**:

- **URL**: `https://your-domain.vercel.app/api/cron/tick`
- **Schedule**: كل 5 دقائق (`*/5 * * * *`)
- **Headers**:
  ```http
  Authorization: Bearer <CRON_SECRET>
  ```

---

## 🧪 فحص الاتصال بالزهراء مستقلاً عبر التيرمينال
```bash
npx tsx scripts/test-zahraa.ts <رقمك_القومي> <كلمة_مرور_الزهراء>
```

---

## ✅ تشغيل الموقع محلياً
```bash
npm run dev
```
افتح المتصفح على: `http://localhost:3000`.
