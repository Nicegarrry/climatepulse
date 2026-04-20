// ASX trading hours: 10:00–16:30 Sydney local, Mon–Fri (covers continuous
// match + closing single-price auction). Vercel Cron is UTC-only, so we
// schedule a wide UTC superset and gate at runtime here using Intl, which
// always uses the current TZ database for Australia/Sydney (handles DST).

interface SydneyClock {
  weekday: string;
  hour: number;
  minute: number;
}

function sydneyClock(now: Date): SydneyClock {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  const minuteStr = parts.find((p) => p.type === "minute")?.value ?? "0";
  const hour = (Number(hourStr) % 24) || 0;
  const minute = Number(minuteStr) || 0;
  return { weekday, hour, minute };
}

const WEEKDAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

/**
 * True during ASX continuous trading + closing auction (10:00–16:30 Mon–Fri
 * Sydney local). Used to gate the announcements cron, which fires every
 * 30 min from a UTC superset that overshoots into out-of-hours periods.
 */
export function isTradingHours(now: Date = new Date()): boolean {
  const { weekday, hour, minute } = sydneyClock(now);
  if (!WEEKDAYS.has(weekday)) return false;
  if (hour < 10 || hour > 16) return false;
  if (hour === 16 && minute > 30) return false;
  return true;
}

export function describeSydneyClock(now: Date = new Date()): string {
  const { weekday, hour, minute } = sydneyClock(now);
  return `${weekday} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} Sydney`;
}
