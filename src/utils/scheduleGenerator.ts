import { addDays, getDay, getDate, getDaysInMonth, differenceInCalendarWeeks, startOfWeek, format } from "date-fns";
import en from "@/locales/en.json";
import id from "@/locales/id.json";

export interface TimeSlot {
  startTime: string;
  endTime: string;
  label?: string;
}

export interface Session {
  date: Date;
  sessionNumber: number;
  startTime: string;
  endTime: string;
  slotLabel?: string;
  rolledFrom?: Date;
  location?: string;
  notes?: string;
  trackId?: string;
  trackName?: string;
  trackColor?: string;
}

const MAX_SESSIONS = 1000;
const ROLL_FORWARD_MAX_DAYS = 14;

export type HolidayBehavior = "skip" | "rollForward";

export type Recurrence =
  | { type: "weekly"; interval: number }
  | { type: "monthlyByWeekday"; ordinals: number[] } // 1..4, -1 for last
  | { type: "monthlyByDate"; daysOfMonth: number[] }; // 1..31, -1 for last day

interface GenerateScheduleOptions {
  startDate: Date;
  selectedDays: number[]; // 0 = Sunday, 1 = Monday, etc. (used for weekly + monthlyByWeekday)
  timeSlots: TimeSlot[];
  holidays?: Date[];
  holidayBehavior?: HolidayBehavior;
  recurrence?: Recurrence;
  mode: "count" | "endDate";
  numberOfMeetings?: number;
  endDate?: Date;
}

function ordinalInMonth(date: Date): number {
  // 1..5
  return Math.floor((getDate(date) - 1) / 7) + 1;
}
function isLastWeekdayOccurrenceInMonth(date: Date): boolean {
  return getDate(date) + 7 > getDaysInMonth(date);
}

function effectiveMonthDays(daysOfMonth: number[], monthLastDay: number): Set<number> {
  const set = new Set<number>();
  for (const d of daysOfMonth) {
    if (d === -1) set.add(monthLastDay);
    else if (d >= 1 && d <= 31) set.add(Math.min(d, monthLastDay));
  }
  return set;
}

export function generateSchedule(options: GenerateScheduleOptions): Session[] {
  const {
    startDate,
    selectedDays,
    timeSlots,
    holidays = [],
    holidayBehavior = "skip",
    recurrence = { type: "weekly", interval: 1 },
    mode,
    numberOfMeetings,
    endDate,
  } = options;

  const sessions: Session[] = [];
  let currentDate = new Date(startDate);
  let sessionCount = 0;

  const sortedDays = [...selectedDays].sort();
  const holidayStrings = new Set(holidays.map((d) => format(d, "yyyy-MM-dd")));
  const slots: TimeSlot[] = timeSlots.length > 0 ? timeSlots : [{ startTime: "", endTime: "" }];

  const target = mode === "count" ? Math.min(numberOfMeetings ?? 0, MAX_SESSIONS) : MAX_SESSIONS;
  const usedRolledDates = new Set<string>();

  const startWeekAnchor = startOfWeek(startDate, { weekStartsOn: 0 });

  // Recurrence-aware predicate: does this date match the recurrence pattern (ignoring holidays)?
  const isRecurrenceCandidate = (d: Date): boolean => {
    const dow = getDay(d);
    if (recurrence.type === "weekly") {
      if (!sortedDays.includes(dow)) return false;
      const interval = Math.max(1, recurrence.interval);
      if (interval === 1) return true;
      const weeksFromStart = differenceInCalendarWeeks(d, startWeekAnchor, { weekStartsOn: 0 });
      return weeksFromStart >= 0 && weeksFromStart % interval === 0;
    }
    if (recurrence.type === "monthlyByWeekday") {
      if (!sortedDays.includes(dow)) return false;
      const ord = ordinalInMonth(d);
      const hits = recurrence.ordinals.includes(ord);
      const hitsLast = recurrence.ordinals.includes(-1) && isLastWeekdayOccurrenceInMonth(d);
      return hits || hitsLast;
    }
    // monthlyByDate
    const lastDay = getDaysInMonth(d);
    const effective = effectiveMonthDays(recurrence.daysOfMonth, lastDay);
    return effective.has(getDate(d));
  };

  // For roll-forward, define "allowed" probe day: non-holiday and matches dow restrictions (if any).
  const isAllowedDowForRoll = (dow: number): boolean => {
    if (recurrence.type === "monthlyByDate") return true;
    return sortedDays.includes(dow);
  };

  const pushDate = (d: Date, rolledFrom?: Date): boolean => {
    for (const slot of slots) {
      if (sessionCount >= target) return true;
      sessions.push({
        date: new Date(d),
        sessionNumber: sessionCount + 1,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotLabel: slot.label?.trim() ? slot.label.trim() : undefined,
        ...(rolledFrom ? { rolledFrom: new Date(rolledFrom) } : {}),
      });
      sessionCount++;
    }
    return sessionCount >= target;
  };

  const findRollForward = (from: Date): Date | null => {
    let probe = addDays(from, 1);
    for (let i = 0; i < ROLL_FORWARD_MAX_DAYS; i++) {
      const probeStr = format(probe, "yyyy-MM-dd");
      const probeDow = getDay(probe);
      if (
        isAllowedDowForRoll(probeDow) &&
        !holidayStrings.has(probeStr) &&
        !usedRolledDates.has(probeStr)
      ) {
        return probe;
      }
      probe = addDays(probe, 1);
    }
    return null;
  };

  const handleCandidate = (d: Date): boolean => {
    if (!isRecurrenceCandidate(d)) return false;
    const dStr = format(d, "yyyy-MM-dd");
    if (usedRolledDates.has(dStr)) return false;

    if (!holidayStrings.has(dStr)) {
      usedRolledDates.add(dStr);
      return pushDate(d);
    }
    if (holidayBehavior === "skip") return false;
    const replacement = findRollForward(d);
    if (!replacement) return false;
    const repStr = format(replacement, "yyyy-MM-dd");
    usedRolledDates.add(repStr);
    return pushDate(replacement, d);
  };

  // Safety cap on day iterations to avoid runaway loops in count mode
  const MAX_ITER_DAYS = 366 * 10;
  let iter = 0;

  if (mode === "count") {
    while (sessionCount < target && iter < MAX_ITER_DAYS) {
      if (handleCandidate(currentDate)) break;
      currentDate = addDays(currentDate, 1);
      iter++;
    }
  } else {
    if (!endDate) return [];
    const endStr = format(endDate, "yyyy-MM-dd");
    while (sessionCount < MAX_SESSIONS && iter < MAX_ITER_DAYS) {
      const dStr = format(currentDate, "yyyy-MM-dd");
      if (dStr > endStr) break;
      handleCandidate(currentDate);
      currentDate = addDays(currentDate, 1);
      iter++;
    }
  }

  return sessions;
}

function convertTo12Hour(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export interface ExportOptions {
  location?: string;
  notes?: string;
  reminderMinutes?: number;
  timezone?: string;
  includeTrackColumn?: boolean;
  filename?: string;
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function buildTrigger(minutes: number): string {
  if (minutes % 1440 === 0) return `-P${minutes / 1440}D`;
  if (minutes % 60 === 0) return `-PT${minutes / 60}H`;
  return `-PT${minutes}M`;
}

function subjectFor(eventName: string, sessionNumber: number, sessionWord: string, slotLabel?: string): string {
  const base = `${eventName} - ${sessionWord} ${sessionNumber}`;
  return slotLabel ? `${base} (${slotLabel})` : base;
}

export function exportToCSV(sessions: Session[], eventName: string, language: string = 'en', opts: ExportOptions = {}): void {
  const t = language === 'id' ? id : en;
  const includeTrack = !!opts.includeTrackColumn;

  const headers = [
    "Subject",
    "Start Date",
    "Start Time",
    "End Date",
    "End Time",
    "All Day Event",
    "Description",
    "Location",
    "Private",
    ...(includeTrack ? ["Class"] : []),
  ];

  const baseLocation = opts.location ?? "";
  const baseNotes = opts.notes ?? "";

  const rows = sessions.map(session => {
    const dateStr = format(session.date, "MM/dd/yyyy");
    const subject = subjectFor(eventName, session.sessionNumber, t.schedule.session, session.slotLabel);
    const baseDescription = `${t.schedule.session} ${session.sessionNumber} ${t.export.description.split(' ')[0]} ${eventName}`;
    const rolledNote = session.rolledFrom
      ? `${(t.schedule as any).rolledFromBadge} ${format(session.rolledFrom, "MMM d, yyyy")}`
      : "";
    const effLocation = session.location ?? baseLocation;
    const effNotes = session.notes ?? baseNotes;
    const descParts = [baseDescription];
    if (session.trackName) descParts.push(`Class: ${session.trackName}`);
    if (rolledNote) descParts.push(rolledNote);
    if (effNotes) descParts.push(effNotes);
    const description = descParts.join("\n\n");

    return [
      subject,
      dateStr,
      convertTo12Hour(session.startTime),
      dateStr,
      convertTo12Hour(session.endTime),
      "False",
      description,
      effLocation,
      "",
      ...(includeTrack ? [session.trackName ?? ""] : []),
    ];
  });

  const neutralizeFormula = (cell: string) => {
    const s = String(cell);
    return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  };
  const escapeCSV = (cell: string) => `"${neutralizeFormula(cell).replace(/"/g, '""')}"`;

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(escapeCSV).join(",")),
  ].join("\n");

  downloadFile(csvContent, `${opts.filename || eventName || "schedule"}.csv`, "text/csv");
}

function sanitizeTzid(tz: string | undefined): string {
  if (!tz) return "UTC";
  const stripped = tz.replace(/[\r\n\t\x00-\x1F\x7F]/g, "").trim();
  if (!stripped) return "UTC";
  try {
    const anyIntl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    if (typeof anyIntl.supportedValuesOf === "function") {
      const list = anyIntl.supportedValuesOf("timeZone");
      if (list.includes(stripped)) return stripped;
      return "UTC";
    }
  } catch {
    // fall through to regex check
  }
  return /^[A-Za-z0-9_+\-/]+$/.test(stripped) ? stripped : "UTC";
}

function sanitizeUidPart(s: string | undefined): string {
  if (!s) return "";
  return s.replace(/[^A-Za-z0-9_-]/g, "");
}

export function exportToICS(sessions: Session[], eventName: string, language: string = 'en', opts: ExportOptions = {}): void {
  const t = language === 'id' ? id : en;
  const tz = sanitizeTzid(opts.timezone);
  const useFloatingTzid = tz !== "UTC";

  const formatLocalICS = (date: Date, time: string): string => {
    const [h, m] = time.split(":");
    const y = date.getFullYear().toString().padStart(4, "0");
    const mo = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    return `${y}${mo}${d}T${h.padStart(2, "0")}${m.padStart(2, "0")}00`;
  };

  const formatUtcICS = (date: Date, time: string): string => {
    const [hours, minutes] = time.split(":");
    const dt = new Date(date);
    dt.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const dtPrefix = useFloatingTzid ? `;TZID=${tz}` : "";
  const formatDT = (d: Date, time: string) =>
    useFloatingTzid ? formatLocalICS(d, time) : formatUtcICS(d, time);

  const events = sessions.map(session => {
    const startDateTime = formatDT(session.date, session.startTime);
    const endDateTime = formatDT(session.date, session.endTime);

    const baseSummary = t.export.summary
      .replace('{{eventName}}', eventName)
      .replace('{{sessionNumber}}', session.sessionNumber.toString());
    const summaryParts = [baseSummary];
    if (session.trackName) summaryParts.push(`[${session.trackName}]`);
    if (session.slotLabel) summaryParts.push(`(${session.slotLabel})`);
    const summary = summaryParts.join(" ");
    const baseDescription = t.export.description
      .replace('{{sessionNumber}}', session.sessionNumber.toString())
      .replace('{{eventName}}', eventName);
    const rolledNote = session.rolledFrom
      ? `${(t.schedule as any).rolledFromBadge} ${format(session.rolledFrom, "MMM d, yyyy")}`
      : "";
    const effLocation = session.location ?? opts.location;
    const effNotes = session.notes ?? opts.notes;
    const descParts = [baseDescription];
    if (session.trackName) descParts.push(`Class: ${session.trackName}`);
    if (rolledNote) descParts.push(rolledNote);
    if (effNotes) descParts.push(effNotes);
    const fullDescription = descParts.join("\n\n");

    const lines = [
      "BEGIN:VEVENT",
      `DTSTART${dtPrefix}:${startDateTime}`,
      `DTEND${dtPrefix}:${endDateTime}`,
      `SUMMARY:${escapeICS(summary)}`,
      `DESCRIPTION:${escapeICS(fullDescription)}`,
    ];
    if (effLocation) lines.push(`LOCATION:${escapeICS(effLocation)}`);
    lines.push(`UID:${Date.now()}-${session.sessionNumber}-${sanitizeUidPart(session.trackId)}-${sanitizeUidPart(session.slotLabel)}@schedule-generator.com`);
    if (opts.reminderMinutes && opts.reminderMinutes > 0) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeICS(summary)}`,
        `TRIGGER:${buildTrigger(opts.reminderMinutes)}`,
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
    return lines.join("\r\n");
  }).join("\r\n");

  const vtimezone = useFloatingTzid
    ? ["BEGIN:VTIMEZONE", `TZID:${tz}`, "END:VTIMEZONE"].join("\r\n")
    : null;

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Schedule Generator//EN",
    "CALSCALE:GREGORIAN",
    ...(vtimezone ? [vtimezone] : []),
    events,
    "END:VCALENDAR",
  ].join("\r\n");

  downloadFile(icsContent, `${opts.filename || eventName || "schedule"}.ics`, "text/calendar");
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
