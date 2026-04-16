// Date + week helpers for the Editor tab.

export function toISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Monday-based ISO week. Given any date, returns the Monday of that week.
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun .. 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift Sunday back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() + 6);
  return d;
}

export function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(weekEnd + "T00:00:00");
  const startStr = start.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  const endStr = end.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  return `${startStr} \u2013 ${endStr}`;
}

// Produce current (this) week start/end in ISO-date form
export function currentWeekRange(): { start: string; end: string } {
  const now = new Date();
  const start = getWeekStart(now);
  const end = getWeekEnd(start);
  return { start: toISODate(start), end: toISODate(end) };
}
