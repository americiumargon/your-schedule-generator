interface GCalSession {
  date: Date;
  startTime: string;
  endTime: string;
  slotLabel?: string;
  location?: string;
  notes?: string;
  rolledFrom?: Date;
}

function pad(n: number, w = 2) {
  return n.toString().padStart(w, "0");
}

function formatLocal(date: Date, time: string): string {
  const [h, m] = time.split(":");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(parseInt(h))}${pad(parseInt(m))}00`;
}

function formatUtc(date: Date, time: string): string {
  const [h, m] = time.split(":");
  const dt = new Date(date);
  dt.setHours(parseInt(h), parseInt(m), 0, 0);
  return dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function formatDateOnlyUtc(date: Date, time: string): string {
  // UNTIL value in UTC for RRULE
  const [h, m] = time.split(":");
  const dt = new Date(date);
  dt.setHours(parseInt(h), parseInt(m), 0, 0);
  return dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export type GCalResult =
  | { url: string }
  | { url: null; reason: "too_many" | "empty" | "not_representable" };

const MAX_SESSIONS = 50;
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function daysBetween(a: Date, b: Date): number {
  const ms = 24 * 60 * 60 * 1000;
  const ad = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bd = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bd - ad) / ms);
}

interface WeeklyPattern {
  intervalWeeks: number;
  byday: string[];
}

/**
 * Detect a clean weekly pattern: same set of weekdays repeated every N weeks,
 * with no gaps or extras. Returns null if not representable as one RRULE.
 */
function detectWeeklyPattern(sessions: GCalSession[]): WeeklyPattern | null {
  if (sessions.length === 1) return { intervalWeeks: 1, byday: [BYDAY[sessions[0].date.getDay()]] };

  const sorted = [...sessions].sort((a, b) => a.date.getTime() - b.date.getTime());
  const weekdays = Array.from(new Set(sorted.map((s) => s.date.getDay()))).sort();
  const byday = weekdays.map((d) => BYDAY[d]);

  // Group sessions into weeks relative to first session's week.
  const first = sorted[0].date;
  const firstWeekStart = new Date(first);
  firstWeekStart.setDate(first.getDate() - first.getDay()); // Sunday-anchored
  firstWeekStart.setHours(0, 0, 0, 0);

  // Bucket by weekIndex
  const buckets = new Map<number, Set<number>>();
  for (const s of sorted) {
    const weekIdx = Math.floor(daysBetween(firstWeekStart, s.date) / 7);
    if (!buckets.has(weekIdx)) buckets.set(weekIdx, new Set());
    buckets.get(weekIdx)!.add(s.date.getDay());
  }

  const weekIndices = [...buckets.keys()].sort((a, b) => a - b);
  if (weekIndices[0] !== 0) return null;

  // Determine interval: gap between consecutive active weeks must be constant.
  let interval = 1;
  if (weekIndices.length > 1) {
    interval = weekIndices[1] - weekIndices[0];
    if (interval < 1) return null;
    for (let i = 1; i < weekIndices.length; i++) {
      if (weekIndices[i] - weekIndices[i - 1] !== interval) return null;
    }
  }

  // Each active week must contain exactly the same set of weekdays.
  const expected = new Set(weekdays);
  for (const idx of weekIndices) {
    const got = buckets.get(idx)!;
    if (got.size !== expected.size) return null;
    for (const d of expected) if (!got.has(d)) return null;
  }

  return { intervalWeeks: interval, byday };
}

export function buildGoogleCalendarUrl(
  eventName: string,
  sessions: GCalSession[],
  location?: string,
  notes?: string,
  timezone?: string
): GCalResult {
  if (sessions.length === 0) return { url: null, reason: "empty" };
  if (sessions.length > MAX_SESSIONS) return { url: null, reason: "too_many" };

  const sorted = [...sessions].sort((a, b) => a.date.getTime() - b.date.getTime());
  const anchor = sorted[0];

  const tz = timezone && timezone.trim() ? timezone : "";
  const useTz = tz && tz !== "UTC";

  // Single-session: trivial single event.
  if (sorted.length === 1) {
    const startStr = useTz ? formatLocal(anchor.date, anchor.startTime) : formatUtc(anchor.date, anchor.startTime);
    const endStr = useTz ? formatLocal(anchor.date, anchor.endTime) : formatUtc(anchor.date, anchor.endTime);
    const params = new URLSearchParams();
    params.set("action", "TEMPLATE");
    const titleBase = eventName || "Event";
    params.set("text", anchor.slotLabel ? `${titleBase} (${anchor.slotLabel})` : titleBase);
    params.set("dates", `${startStr}/${endStr}`);
    if (useTz) params.set("ctz", tz);
    const effLoc = anchor.location ?? location;
    const effNotes = anchor.notes ?? notes;
    if (effLoc) params.set("location", effLoc);
    if (effNotes) params.set("details", effNotes);
    return { url: `https://calendar.google.com/calendar/render?${params.toString()}` };
  }

  // Multi-session: must be representable as a single RRULE.
  // Disqualifiers: time conflicts, per-session overrides, rolled-from exceptions.
  const sameTimes = sorted.every(
    (s) => s.startTime === anchor.startTime && s.endTime === anchor.endTime
  );
  const noOverrides = sorted.every((s) => s.location === undefined && s.notes === undefined);
  const noRolled = sorted.every((s) => !s.rolledFrom);
  const sameLabel = sorted.every((s) => s.slotLabel === anchor.slotLabel);

  if (!sameTimes || !noOverrides || !noRolled || !sameLabel) {
    return { url: null, reason: "not_representable" };
  }

  const pattern = detectWeeklyPattern(sorted);
  if (!pattern) return { url: null, reason: "not_representable" };

  const startStr = useTz ? formatLocal(anchor.date, anchor.startTime) : formatUtc(anchor.date, anchor.startTime);
  const endStr = useTz ? formatLocal(anchor.date, anchor.endTime) : formatUtc(anchor.date, anchor.endTime);

  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  const titleBase = eventName || "Event";
  params.set("text", anchor.slotLabel ? `${titleBase} (${anchor.slotLabel})` : titleBase);
  params.set("dates", `${startStr}/${endStr}`);
  if (useTz) params.set("ctz", tz);
  if (location) params.set("location", location);
  if (notes) params.set("details", notes);

  // Build RRULE. Prefer COUNT for exactness.
  const rrule = `RRULE:FREQ=WEEKLY;INTERVAL=${pattern.intervalWeeks};BYDAY=${pattern.byday.join(",")};COUNT=${sorted.length}`;
  params.set("recur", rrule);

  return { url: `https://calendar.google.com/calendar/render?${params.toString()}` };
}
