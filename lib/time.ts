/**
 * Time and Timezone utilities for Africa/Cairo.
 * Never hardcodes UTC offsets (Egypt has DST changes).
 */

export const CAIRO_TZ = "Africa/Cairo";

export interface CairoDateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:MM
}

/**
 * Gets the current date and time parts in Cairo timezone.
 */
export function getCairoNow(date: Date = new Date()): CairoDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CAIRO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  const hour = parseInt(partMap.hour === "24" ? "00" : partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);

  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateStr,
    timeStr,
  };
}

/**
 * Gets tomorrow's date string in Cairo (YYYY-MM-DD).
 * Adds 24 hours to the current Cairo time and returns its YYYY-MM-DD.
 */
export function getTomorrowCairoDate(date: Date = new Date()): string {
  // Adding 25 hours safely lands in tomorrow in Cairo regardless of 1hr DST shift
  const tomorrow = new Date(date.getTime() + 25 * 60 * 60 * 1000);
  return getCairoNow(tomorrow).dateStr;
}

/**
 * Formats a YYYY-MM-DD date into friendly Arabic string, e.g.:
 * "السبت 17 أكتوبر"
 */
export function formatArabicDate(dateStr: string): string {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  // Construct UTC date at noon to avoid boundary shifts
  const d = new Date(Date.UTC(year, month, day, 12, 0, 0));

  const formatter = new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return formatter.format(d);
}

/**
 * Checks if the current Cairo time is at or after 20:00 (8:00 PM).
 */
export function isPastCairoBookingDeadline(now: Date = new Date()): boolean {
  const cairo = getCairoNow(now);
  return cairo.hour >= 20;
}

/**
 * Checks if current Cairo time is at or past a specified hour and minute.
 */
export function isAtOrAfterCairoTime(
  hour: number,
  minute: number = 0,
  now: Date = new Date()
): boolean {
  const cairo = getCairoNow(now);
  if (cairo.hour > hour) return true;
  if (cairo.hour === hour && cairo.minute >= minute) return true;
  return false;
}

/**
 * Calculates an expiration ISO string for today at 20:00 Cairo time.
 * If current Cairo time is already past 20:00, returns a date in the past.
 */
export function getCairoTodayDeadlineIso(now: Date = new Date()): string {
  const cairo = getCairoNow(now);

  // Calculate difference to today 20:00:00 in Cairo
  const hoursUntil8pm = 20 - cairo.hour;
  const minutesUntil8pm = 0 - cairo.minute;
  const secondsUntil8pm = 0 - cairo.second;

  const msOffset =
    (hoursUntil8pm * 3600 + minutesUntil8pm * 60 + secondsUntil8pm) * 1000;

  return new Date(now.getTime() + msOffset).toISOString();
}
