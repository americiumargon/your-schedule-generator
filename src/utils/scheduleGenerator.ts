import { addDays, getDay, format } from "date-fns";
import en from "@/locales/en.json";
import id from "@/locales/id.json";

export interface TimeSlot {
  startTime: string;
  endTime: string;
  label?: string;
}

interface Session {
  date: Date;
  sessionNumber: number;
  startTime: string;
  endTime: string;
  slotLabel?: string;
  rolledFrom?: Date;
}

const MAX_SESSIONS = 1000;
const ROLL_FORWARD_MAX_DAYS = 14;

export type HolidayBehavior = "skip" | "rollForward";

interface GenerateScheduleOptions {
  startDate: Date;
  selectedDays: number[]; // 0 = Sunday, 1 = Monday, etc.
  timeSlots: TimeSlot[];
  holidays?: Date[];
  holidayBehavior?: HolidayBehavior;
  mode: "count" | "endDate";
  numberOfMeetings?: number;
  endDate?: Date;
}

export function generateSchedule(options: GenerateScheduleOptions): Session[] {
  const {
    startDate,
    selectedDays,
    timeSlots,
    holidays = [],
    holidayBehavior = "skip",
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
  const usedRolledDates = new Set<string>(); // prevent rolling onto a date already produced

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

  // For a candidate date that's a holiday, find the next valid date within ROLL_FORWARD_MAX_DAYS.
  // Returns null if no replacement found.
  const findRollForward = (from: Date): Date | null => {
    let probe = addDays(from, 1);
    for (let i = 0; i < ROLL_FORWARD_MAX_DAYS; i++) {
      const probeStr = format(probe, "yyyy-MM-dd");
      const probeDow = getDay(probe);
      if (
        sortedDays.includes(probeDow) &&
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
    const dStr = format(d, "yyyy-MM-dd");
    const dow = getDay(d);
    if (!sortedDays.includes(dow)) return false;

    if (!holidayStrings.has(dStr)) {
      usedRolledDates.add(dStr);
      return pushDate(d);
    }
    // Holiday hit
    if (holidayBehavior === "skip") return false;
    const replacement = findRollForward(d);
    if (!replacement) return false;
    const repStr = format(replacement, "yyyy-MM-dd");
    usedRolledDates.add(repStr);
    return pushDate(replacement, d);
  };

  if (mode === "count") {
    while (sessionCount < target) {
      if (handleCandidate(currentDate)) break;
      currentDate = addDays(currentDate, 1);
    }
  } else {
    if (!endDate) return [];
    const endStr = format(endDate, "yyyy-MM-dd");
    while (sessionCount < MAX_SESSIONS) {
      const dStr = format(currentDate, "yyyy-MM-dd");
      if (dStr > endStr) break;
      handleCandidate(currentDate);
      currentDate = addDays(currentDate, 1);
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

  const headers = [
    "Subject",
    "Start Date",
    "Start Time",
    "End Date",
    "End Time",
    "All Day Event",
    "Description",
    "Location",
    "Private"
  ];

  const baseLocation = opts.location ?? "";
  const notes = opts.notes ?? "";

  const rows = sessions.map(session => {
    const dateStr = format(session.date, "MM/dd/yyyy");
    const subject = subjectFor(eventName, session.sessionNumber, t.schedule.session, session.slotLabel);
    const baseDescription = `${t.schedule.session} ${session.sessionNumber} ${t.export.description.split(' ')[0]} ${eventName}`;
    const rolledNote = session.rolledFrom
      ? `${t.schedule.rolledFromBadge} ${format(session.rolledFrom, "MMM d, yyyy")}`
      : "";
    const descParts = [baseDescription];
    if (rolledNote) descParts.push(rolledNote);
    if (notes) descParts.push(notes);
    const description = descParts.join("\n\n");

    return [
      subject,
      dateStr,
      convertTo12Hour(session.startTime),
      dateStr,
      convertTo12Hour(session.endTime),
      "False",
      description,
      baseLocation,
      ""
    ];
  });

  const escapeCSV = (cell: string) => `"${String(cell).replace(/"/g, '""')}"`;

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(escapeCSV).join(",")),
  ].join("\n");

  downloadFile(csvContent, `${eventName || "schedule"}.csv`, "text/csv");
}

export function exportToICS(sessions: Session[], eventName: string, language: string = 'en', opts: ExportOptions = {}): void {
  const t = language === 'id' ? id : en;
  const tz = opts.timezone && opts.timezone.trim() ? opts.timezone : "UTC";
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

  const locationLine = opts.location ? `LOCATION:${escapeICS(opts.location)}` : null;

  const events = sessions.map(session => {
    const startDateTime = formatDT(session.date, session.startTime);
    const endDateTime = formatDT(session.date, session.endTime);

    const baseSummary = t.export.summary
      .replace('{{eventName}}', eventName)
      .replace('{{sessionNumber}}', session.sessionNumber.toString());
    const summary = session.slotLabel ? `${baseSummary} (${session.slotLabel})` : baseSummary;
    const baseDescription = t.export.description
      .replace('{{sessionNumber}}', session.sessionNumber.toString())
      .replace('{{eventName}}', eventName);
    const rolledNote = session.rolledFrom
      ? `${t.schedule.rolledFromBadge} ${format(session.rolledFrom, "MMM d, yyyy")}`
      : "";
    const descParts = [baseDescription];
    if (rolledNote) descParts.push(rolledNote);
    if (opts.notes) descParts.push(opts.notes);
    const fullDescription = descParts.join("\n\n");

    const lines = [
      "BEGIN:VEVENT",
      `DTSTART${dtPrefix}:${startDateTime}`,
      `DTEND${dtPrefix}:${endDateTime}`,
      `SUMMARY:${escapeICS(summary)}`,
      `DESCRIPTION:${escapeICS(fullDescription)}`,
    ];
    if (locationLine) lines.push(locationLine);
    lines.push(`UID:${Date.now()}-${session.sessionNumber}-${session.slotLabel ?? ''}@schedule-generator.com`);
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

  downloadFile(icsContent, `${eventName || "schedule"}.ics`, "text/calendar");
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
