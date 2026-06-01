import { z } from "zod";
import type { ExportOptions } from "./scheduleGenerator";

// Local TZ check (avoids circular import with scheduleGenerator).
function isValidTimezone(tz: string): boolean {
  if (/[\r\n\t\x00-\x1F\x7F]/.test(tz)) return false;
  if (tz === "UTC") return true;
  try {
    // Trust the runtime: if Intl can format with this zone, accept it.
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

// Constants shared with UI
export const MIN_YEAR = 1970;
export const MAX_YEAR = 2100;
export const MAX_MEETINGS = 366;
export const MAX_WEEKLY_INTERVAL = 12;
export const MAX_TIME_SLOTS = 6;
export const MAX_TRACKS = 12;
export const VALID_ORDINALS = [1, 2, 3, 4, -1] as const;
export const VALID_REMINDERS = [0, 5, 15, 30, 60, 1440] as const;
export const MAX_TEXT_LEN = 500;
export const MAX_NAME_LEN = 200;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Error codes used by callers to map to translated strings.
export type ValidationCode =
  | "dateInvalid"
  | "dateOutOfRange"
  | "endBeforeStart"
  | "timezoneInvalid"
  | "meetingsInvalid"
  | "meetingsOutOfRange"
  | "intervalInvalid"
  | "ordinalsInvalid"
  | "daysOfMonthInvalid"
  | "daysOfWeekInvalid"
  | "timeSlotInvalid"
  | "timeSlotOrder"
  | "timeSlotsCount"
  | "reminderInvalid"
  | "textTooLong";

export class ExportValidationError extends Error {
  code: ValidationCode;
  constructor(code: ValidationCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "ExportValidationError";
  }
}

// ---------- Date ----------
export function validateDate(d: unknown): ValidationCode | null {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "dateInvalid";
  const y = d.getFullYear();
  if (y < MIN_YEAR || y > MAX_YEAR) return "dateOutOfRange";
  return null;
}

// ---------- Timezone ----------
export const timezoneSchema = z
  .string()
  .min(1, "timezoneInvalid")
  .max(64, "timezoneInvalid")
  .refine((s) => !/[\r\n\t\x00-\x1F\x7F]/.test(s), { message: "timezoneInvalid" })
  .refine((s) => isValidTimezone(s), { message: "timezoneInvalid" });

export function validateTimezone(tz: unknown): ValidationCode | null {
  const res = timezoneSchema.safeParse(tz);
  return res.success ? null : "timezoneInvalid";
}

// ---------- Frequency / counts ----------
export const meetingsSchema = z
  .number({ invalid_type_error: "meetingsInvalid" })
  .int("meetingsInvalid")
  .min(1, "meetingsOutOfRange")
  .max(MAX_MEETINGS, "meetingsOutOfRange");

export function validateMeetings(input: unknown): ValidationCode | null {
  if (typeof input === "string") {
    if (!/^\d+$/.test(input.trim())) return "meetingsInvalid";
    input = parseInt(input, 10);
  }
  if (typeof input !== "number" || !Number.isFinite(input)) return "meetingsInvalid";
  const res = meetingsSchema.safeParse(input);
  if (res.success) return null;
  return (res.error.issues[0]?.message as ValidationCode) ?? "meetingsInvalid";
}

export const intervalSchema = z
  .number({ invalid_type_error: "intervalInvalid" })
  .int("intervalInvalid")
  .min(1, "intervalInvalid")
  .max(MAX_WEEKLY_INTERVAL, "intervalInvalid");

export function validateInterval(n: unknown): ValidationCode | null {
  const res = intervalSchema.safeParse(n);
  return res.success ? null : "intervalInvalid";
}

export const ordinalsSchema = z
  .array(z.number().int().refine((n) => (VALID_ORDINALS as readonly number[]).includes(n), "ordinalsInvalid"))
  .min(1, "ordinalsInvalid")
  .max(5, "ordinalsInvalid");

export function validateOrdinals(arr: unknown): ValidationCode | null {
  if (!Array.isArray(arr)) return "ordinalsInvalid";
  const deduped = Array.from(new Set(arr));
  const res = ordinalsSchema.safeParse(deduped);
  return res.success ? null : "ordinalsInvalid";
}

export const daysOfMonthSchema = z
  .array(
    z
      .number()
      .int()
      .refine((n) => n === -1 || (n >= 1 && n <= 31), "daysOfMonthInvalid"),
  )
  .min(1, "daysOfMonthInvalid")
  .max(31, "daysOfMonthInvalid");

export function validateDaysOfMonth(arr: unknown): ValidationCode | null {
  if (!Array.isArray(arr)) return "daysOfMonthInvalid";
  const deduped = Array.from(new Set(arr));
  const res = daysOfMonthSchema.safeParse(deduped);
  return res.success ? null : "daysOfMonthInvalid";
}

export const daysOfWeekSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1, "daysOfWeekInvalid")
  .max(7, "daysOfWeekInvalid");

export function validateDaysOfWeek(arr: unknown): ValidationCode | null {
  if (!Array.isArray(arr)) return "daysOfWeekInvalid";
  const deduped = Array.from(new Set(arr));
  const res = daysOfWeekSchema.safeParse(deduped);
  return res.success ? null : "daysOfWeekInvalid";
}

// ---------- Time slots ----------
export interface TimeSlotLike {
  startTime: string;
  endTime: string;
  label?: string;
}

export function validateTimeSlots(slots: unknown): ValidationCode | null {
  if (!Array.isArray(slots) || slots.length === 0) return "timeSlotsCount";
  if (slots.length > MAX_TIME_SLOTS) return "timeSlotsCount";
  for (const s of slots as TimeSlotLike[]) {
    if (!s || typeof s.startTime !== "string" || typeof s.endTime !== "string") return "timeSlotInvalid";
    if (!TIME_RE.test(s.startTime) || !TIME_RE.test(s.endTime)) return "timeSlotInvalid";
    if (s.startTime >= s.endTime) return "timeSlotOrder";
    if (s.label && s.label.length > MAX_NAME_LEN) return "textTooLong";
  }
  return null;
}

// ---------- Reminder ----------
export function validateReminder(n: unknown): ValidationCode | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return "reminderInvalid";
  return (VALID_REMINDERS as readonly number[]).includes(n) ? null : "reminderInvalid";
}

// ---------- Export options (hard gate at export boundary) ----------
export function validateExportOptions(opts: ExportOptions | undefined): void {
  if (!opts) return;
  if (opts.timezone !== undefined) {
    const code = validateTimezone(opts.timezone);
    if (code) throw new ExportValidationError(code, `Invalid timezone: ${String(opts.timezone).slice(0, 64)}`);
  }
  if (opts.reminderMinutes !== undefined) {
    const code = validateReminder(opts.reminderMinutes);
    if (code) throw new ExportValidationError(code, `Invalid reminder: ${opts.reminderMinutes}`);
  }
  if (opts.location && opts.location.length > MAX_TEXT_LEN) {
    throw new ExportValidationError("textTooLong", "Location is too long");
  }
  if (opts.notes && opts.notes.length > MAX_TEXT_LEN * 4) {
    throw new ExportValidationError("textTooLong", "Notes are too long");
  }
  if (opts.filename && opts.filename.length > MAX_NAME_LEN) {
    throw new ExportValidationError("textTooLong", "Filename is too long");
  }
}

// Validate that every session has a real date before exporting.
export function assertValidSessionDates(sessions: { date: unknown }[]): void {
  for (const s of sessions) {
    if (!(s.date instanceof Date) || isNaN(s.date.getTime())) {
      throw new ExportValidationError("dateInvalid", "Session contains an invalid date");
    }
    const y = (s.date as Date).getFullYear();
    if (y < MIN_YEAR || y > MAX_YEAR) {
      throw new ExportValidationError("dateOutOfRange", "Session date is out of supported range");
    }
  }
}
