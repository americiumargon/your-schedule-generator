interface GCalSession {
  date: Date;
  startTime: string;
  endTime: string;
  slotLabel?: string;
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

export type GCalResult =
  | { url: string; hasTimeConflicts: boolean }
  | { url: null; reason: "too_many" | "empty" };

const MAX_SESSIONS = 50;

export function buildGoogleCalendarUrl(
  eventName: string,
  sessions: GCalSession[],
  location?: string,
  notes?: string,
  timezone?: string
): GCalResult {
  if (sessions.length === 0) return { url: null, reason: "empty" };
  if (sessions.length > MAX_SESSIONS) return { url: null, reason: "too_many" };

  const tz = timezone && timezone.trim() ? timezone : "";
  const useTz = tz && tz !== "UTC";

  const anchor = sessions[0];
  const startStr = useTz ? formatLocal(anchor.date, anchor.startTime) : formatUtc(anchor.date, anchor.startTime);
  const endStr = useTz ? formatLocal(anchor.date, anchor.endTime) : formatUtc(anchor.date, anchor.endTime);

  const hasTimeConflicts = sessions.some(
    (s) => s.startTime !== anchor.startTime || s.endTime !== anchor.endTime
  );

  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  const titleBase = eventName || "Event";
  params.set("text", anchor.slotLabel ? `${titleBase} (${anchor.slotLabel})` : titleBase);
  params.set("dates", `${startStr}/${endStr}`);
  if (useTz) params.set("ctz", tz);
  if (location) params.set("location", location);
  if (notes) params.set("details", notes);

  if (sessions.length > 1) {
    const rdates = sessions
      .slice(1)
      .map((s) => (useTz ? formatLocal(s.date, anchor.startTime) : formatUtc(s.date, anchor.startTime)))
      .join(",");
    const recur = useTz
      ? `RDATE;TZID=${tz};VALUE=DATE-TIME:${rdates}`
      : `RDATE;VALUE=DATE-TIME:${rdates}`;
    params.set("recur", recur);
  }

  return {
    url: `https://calendar.google.com/calendar/render?${params.toString()}`,
    hasTimeConflicts,
  };
}
