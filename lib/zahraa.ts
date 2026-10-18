import { isPastCairoBookingDeadline } from "./time";

const BASE_URL = "https://hostel.cu.edu.eg";
const REQUEST_TIMEOUT_MS = 10000;

export type ZahraaErrorCode =
  | "INVALID_CREDENTIALS"
  | "SESSION_EXPIRED"
  | "SITE_DOWN"
  | "TIMEOUT"
  | "NO_MEALS"
  | "DEADLINE_PASSED"
  | "ALREADY_BOOKED"
  | "VERIFICATION_FAILED"
  | "UNKNOWN_ERROR";

export class ZahraaError extends Error {
  code: ZahraaErrorCode;
  arabicMessage: string;

  constructor(code: ZahraaErrorCode, message: string, arabicMessage: string) {
    super(message);
    this.name = "ZahraaError";
    this.code = code;
    this.arabicMessage = arabicMessage;
  }
}

export interface ZahraaMeal {
  mealID: string | number;
  mealName: string;
  mealReligion?: string;
  booked: boolean | number;
  disabled?: boolean | number;
  not_red?: boolean;
}

export interface ZahraaDay {
  dayDate: string; // YYYY-MM-DD
  meals: ZahraaMeal[];
}

export interface GetMealsResponse {
  minDate?: string;
  maxDate?: string;
  daysDict: Record<string, ZahraaDay>;
  logout?: boolean;
  hasError?: boolean;
  errMsg?: string;
}

export interface BookChoice {
  lunch: boolean;
  dinner: boolean;
}

export interface BookingResult {
  success: boolean;
  bookedMeals: string[];
  message: string;
  dryRun?: boolean;
}

/**
 * Cookie Jar for maintaining session cookies across requests to Al-Zahraa.
 */
export class CookieJar {
  private cookies: Map<string, string> = new Map();

  updateFromHeaders(headers: Headers) {
    // In node-fetch / undici / Next.js headers, getSetCookie() is available
    const getSetCookie = (headers as { getSetCookie?: () => string[] }).getSetCookie;
    const cookieHeaders = getSetCookie ? getSetCookie.call(headers) : [];

    if (cookieHeaders && cookieHeaders.length > 0) {
      for (const header of cookieHeaders) {
        this.parseCookieHeader(header);
      }
    } else {
      const singleHeader = headers.get("set-cookie");
      if (singleHeader) {
        this.parseCookieHeader(singleHeader);
      }
    }
  }

  private parseCookieHeader(header: string) {
    const cookiePattern = /(?:^|,\s*)([^=;,\s]+)=([^;]*)/g;
    for (const match of header.matchAll(cookiePattern)) {
      this.cookies.set(match[1].trim(), match[2].trim());
    }
  }

  toHeaderString(): string {
    const entries: string[] = [];
    for (const [name, value] of this.cookies.entries()) {
      entries.push(`${name}=${value}`);
    }
    return entries.join("; ");
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }
}

/**
 * Helper to execute a fetch request with timeout and error classification.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        ...options.headers,
      },
    });
    return response;
  } catch (error: unknown) {
    if ((error as { name?: string })?.name === "AbortError") {
      throw new ZahraaError(
        "TIMEOUT",
        "Request to Al-Zahraa timed out after 10s",
        "الموقع مش بيرد (تجاوز وقت الانتظار). يرجى المحاولة لاحقاً"
      );
    }
    throw new ZahraaError(
      "SITE_DOWN",
      `Failed to connect to Al-Zahraa: ${(error as Error).message}`,
      "تعذر الاتصال بموقع الزهراء، قد يكون الموقع متوقفاً حالياً"
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Performs student login on Al-Zahraa.
 * Returns the CookieJar containing session cookies.
 */
export async function loginToZahraa(
  nationalId: string,
  password: string
): Promise<CookieJar> {
  const jar = new CookieJar();

  // The portal creates its login session on the login page before accepting credentials.
  const loginPage = await fetchWithTimeout(`${BASE_URL}/studentLogin`, {
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml",
    },
  });
  jar.updateFromHeaders(loginPage.headers);

  if (!loginPage.ok) {
    throw new ZahraaError(
      "SITE_DOWN",
      `Login page returned HTTP ${loginPage.status}`,
      `رفض موقع الزهراء بدء اتصال الخادم (HTTP ${loginPage.status}). هذا لا يعني أن بياناتك خاطئة؛ قد يحظر الموقع اتصال Vercel.`
    );
  }

  const body = new URLSearchParams({
    txtStudentID: nationalId,
    txtStudentPassword: password,
  }).toString();

  const response = await fetchWithTimeout(`${BASE_URL}/studentHome`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.toHeaderString(),
      Origin: BASE_URL,
      Referer: `${BASE_URL}/studentLogin`,
    },
    body,
    redirect: "manual",
  });

  jar.updateFromHeaders(response.headers);

  // Ensure the portal kept the session initialized by the login page.
  if (!jar.has("connect.sid")) {
    throw new ZahraaError(
      "SITE_DOWN",
      `Login response discarded the session (HTTP ${response.status})`,
      "لم يستكمل موقع الزهراء جلسة تسجيل الدخول. يرجى المحاولة لاحقاً"
    );
  }

  // Register screen session for getMeals
  await registerAppSession(jar, "getMeals");

  return jar;
}

/**
 * Registers screen in the student session: /addStudentAppSession?appName=getMeals
 */
export async function registerAppSession(
  jar: CookieJar,
  appName: string = "getMeals"
): Promise<void> {
  try {
    const response = await fetchWithTimeout(
      `${BASE_URL}/addStudentAppSession?appName=${encodeURIComponent(appName)}`,
      {
        method: "GET",
        headers: {
          Cookie: jar.toHeaderString(),
        },
      }
    );
    jar.updateFromHeaders(response.headers);
  } catch {
    // If registration call fails, log and continue as getMeals might still succeed
  }
}

/**
 * Fetches the meals schedule from Al-Zahraa.
 */
export async function fetchMeals(jar: CookieJar): Promise<GetMealsResponse> {
  const body = new URLSearchParams({
    fnName: "getMeals",
  }).toString();

  const response = await fetchWithTimeout(`${BASE_URL}/studentHome`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.toHeaderString(),
    },
    body,
  });

  jar.updateFromHeaders(response.headers);

  let data: GetMealsResponse;
  try {
    data = (await response.json()) as GetMealsResponse;
  } catch {
    throw new ZahraaError(
      "SITE_DOWN",
      "Al-Zahraa returned invalid JSON response for getMeals",
      "استجاب موقع الزهراء ببيانات غير متوقعة"
    );
  }

  if (data.logout) {
    throw new ZahraaError(
      "SESSION_EXPIRED",
      "Al-Zahraa session expired (logout: true)",
      "انتهت جلسة تسجيل الدخول بموقع الزهراء"
    );
  }

  if (data.hasError) {
    throw new ZahraaError(
      "UNKNOWN_ERROR",
      `Al-Zahraa error: ${data.errMsg || "unknown"}`,
      data.errMsg || "حدث خطأ غير متوقع في موقع الزهراء"
    );
  }

  return data;
}

/**
 * Categorizes meal name into 'lunch' or 'dinner'.
 */
export function categorizeMeal(
  mealName: string
): "lunch" | "dinner" | "other" {
  const normalized = mealName.trim();
  if (normalized.includes("غداء")) return "lunch";
  if (normalized.includes("عشاء")) return "dinner";
  return "other";
}

/**
 * Books tomorrow's meals safely:
 * - Reads current meals state fresh
 * - Preserves ALL already-booked meals across all days (union rule)
 * - Adds chosen meals for targetDate
 * - Verifies booking post-save
 */
export async function bookMealsSafely({
  nationalId,
  password,
  targetDate,
  choice,
}: {
  nationalId: string;
  password: string;
  targetDate: string; // YYYY-MM-DD
  choice: BookChoice;
}): Promise<BookingResult> {
  // 1. Verify deadline
  if (isPastCairoBookingDeadline()) {
    throw new ZahraaError(
      "DEADLINE_PASSED",
      "Booking deadline (20:00 Cairo time) has passed",
      "انتهى موعد الحجز اليومي (الساعة 8:00 مساءً بتوقيت القاهرة)"
    );
  }

  // 2. Login to Al-Zahraa
  const jar = await loginToZahraa(nationalId, password);

  // 3. Fetch meals fresh
  const mealsData = await fetchMeals(jar);
  const daysDict = mealsData.daysDict || {};
  const targetDay = daysDict[targetDate];

  if (!targetDay || !targetDay.meals || targetDay.meals.length === 0) {
    throw new ZahraaError(
      "NO_MEALS",
      `No meals available for target date ${targetDate}`,
      "لا توجد وجبات متاحة للحجز لهذا اليوم"
    );
  }

  // Identify target day's lunch and dinner
  const targetMealsToBook: ZahraaMeal[] = [];
  const chosenMealNames: string[] = [];

  for (const meal of targetDay.meals) {
    const isMealDisabled = Boolean(meal.disabled);
    const category = categorizeMeal(meal.mealName);

    if (category === "lunch" && choice.lunch) {
      if (isMealDisabled) {
        throw new ZahraaError(
          "NO_MEALS",
          "Lunch meal is marked disabled by Al-Zahraa",
          "وجبة الغداء غير متاحة للحجز حالياً في النظام"
        );
      }
      targetMealsToBook.push(meal);
      chosenMealNames.push("غداء");
    }

    if (category === "dinner" && choice.dinner) {
      if (isMealDisabled) {
        throw new ZahraaError(
          "NO_MEALS",
          "Dinner meal is marked disabled by Al-Zahraa",
          "وجبة العشاء غير متاحة للحجز حالياً في النظام"
        );
      }
      targetMealsToBook.push(meal);
      chosenMealNames.push("عشاء");
    }
  }

  if (targetMealsToBook.length === 0) {
    throw new ZahraaError(
      "NO_MEALS",
      "No matching meals found for your choice",
      "لم يتم العثور على وجبات مطابقة لاختيارك"
    );
  }

  // 4. Build the chkMeals UNION list
  // The official site's save sends ALL checked boxes, replacing state.
  // We must preserve EVERY meal currently booked (booked: true/1) across any day,
  // excluding disabled ones, and union with the new choices.
  const chkMealsSet = new Set<string>();

  // Add all currently booked non-disabled meals across all days
  for (const day of Object.values(daysDict)) {
    if (!day || !day.meals) continue;
    for (const meal of day.meals) {
      const isBooked = Boolean(meal.booked);
      const isDisabled = Boolean(meal.disabled);
      if (isBooked && !isDisabled) {
        chkMealsSet.add(`${day.dayDate}|${meal.mealID}`);
      }
    }
  }

  // Add newly chosen meals for tomorrow
  for (const meal of targetMealsToBook) {
    chkMealsSet.add(`${targetDate}|${meal.mealID}`);
  }

  const chkMealsArray = Array.from(chkMealsSet);

  // 5. Handle DRY_RUN mode
  const isDryRun = process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";
  if (isDryRun) {
    return {
      success: true,
      bookedMeals: chosenMealNames,
      message: `[وضع تجريبي DRY_RUN] تم إعداد حجز: ${chosenMealNames.join(" + ")} بنجاح دون إرسال الطلب النهائي`,
      dryRun: true,
    };
  }

  // 6. Execute bookMeals POST
  const params = new URLSearchParams();
  params.append("fnName", "bookMeals");
  for (const item of chkMealsArray) {
    params.append("chkMeals", item);
  }

  const bookResponse = await fetchWithTimeout(`${BASE_URL}/studentHome`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.toHeaderString(),
    },
    body: params.toString(),
  });

  jar.updateFromHeaders(bookResponse.headers);

  let bookData: { hasError?: boolean; errMsg?: string; logout?: boolean };
  try {
    bookData = (await bookResponse.json()) as typeof bookData;
  } catch {
    throw new ZahraaError(
      "SITE_DOWN",
      "Al-Zahraa returned invalid JSON for bookMeals",
      "فشل في معالجة استجابة الحجز من موقع الزهراء"
    );
  }

  if (bookData.logout) {
    throw new ZahraaError(
      "SESSION_EXPIRED",
      "Session expired during bookMeals",
      "انتهت جلسة تسجيل الدخول أثناء الحجز"
    );
  }

  if (bookData.hasError) {
    throw new ZahraaError(
      "UNKNOWN_ERROR",
      `Al-Zahraa book error: ${bookData.errMsg || "unknown"}`,
      bookData.errMsg || "رفض موقع الزهراء حفظ الحجز"
    );
  }

  // 7. Critical Post-booking verification:
  // Fetch getMeals again and verify that all requested target meals are booked: true
  const verifiedMeals = await fetchMeals(jar);
  const verifiedDay = verifiedMeals.daysDict?.[targetDate];

  if (!verifiedDay || !verifiedDay.meals) {
    throw new ZahraaError(
      "VERIFICATION_FAILED",
      "Post-booking verification failed: day not found in schedule",
      "فشل التحقق من الحجز: لم يظهر الحجز في جدول الوجبات"
    );
  }

  for (const requestedMeal of targetMealsToBook) {
    const found = verifiedDay.meals.find(
      (m) => String(m.mealID) === String(requestedMeal.mealID)
    );
    if (!found || !found.booked) {
      throw new ZahraaError(
        "VERIFICATION_FAILED",
        `Post-booking verification failed for meal ${requestedMeal.mealName}`,
        `فشل التحقق: لم يتم تأكيد حجز ${requestedMeal.mealName} في موقع الزهراء`
      );
    }
  }

  return {
    success: true,
    bookedMeals: chosenMealNames,
    message: `تم حجز ${chosenMealNames.join(" + ")} بنجاح وتم التحقق من النظام ✓`,
    dryRun: false,
  };
}
