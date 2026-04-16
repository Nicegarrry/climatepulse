// Newsroom only runs in Sydney business hours (Mon–Fri 06:00–20:00 local),
// regardless of whether daylight saving is in effect. Vercel Cron is UTC-only,
// so we schedule a wide UTC superset and gate at runtime here using Intl —
// which always uses the current TZ database for Australia/Sydney.

interface SydneyClock {
  weekday: string;
  hour: number;
}

function sydneyClock(now: Date): SydneyClock {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  // en-AU sometimes returns "24" for midnight in 24-hour format — normalise.
  const hour = (Number(hourStr) % 24) || 0;
  return { weekday, hour };
}

const WEEKDAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);
const OPEN_HOUR = 6;   // 06:00 local — inclusive
const CLOSE_HOUR = 20; // 20:00 local — exclusive (last fire at 19:30 local)

export function isBusinessHours(now: Date = new Date()): boolean {
  const { weekday, hour } = sydneyClock(now);
  if (!WEEKDAYS.has(weekday)) return false;
  return hour >= OPEN_HOUR && hour < CLOSE_HOUR;
}

export function describeSydneyClock(now: Date = new Date()): string {
  const { weekday, hour } = sydneyClock(now);
  return `${weekday} ${String(hour).padStart(2, "0")}:00 Sydney`;
}
