import { z } from "zod";
import { format, parseISO, isValid } from "date-fns";

export type ShareMode = "count" | "endDate";

export interface ShareFormState {
  eventName: string;
  startDate: Date;
  mode: ShareMode;
  numberOfMeetings?: number;
  endDate?: Date;
  selectedDays: number[];
  startTime: string;
  endTime: string;
  holidays: Date[];
  location?: string;
  notes?: string;
  reminderMinutes: number;
  timezone: string;
}

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeStr = z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/);

const tokenSchema = z.object({
  v: z.literal(1),
  n: z.string().min(1).max(100),
  sd: dateStr,
  m: z.enum(["count", "endDate"]),
  c: z.number().int().min(1).max(366).optional(),
  ed: dateStr.optional(),
  d: z.array(z.number().int().min(0).max(6)).min(1),
  st: timeStr,
  et: timeStr,
  h: z.array(dateStr).max(366),
  l: z.string().max(200).optional(),
  nt: z.string().max(2000).optional(),
  r: z.number().refine((v) => [0, 5, 15, 30, 60, 1440].includes(v)),
  tz: z.string().min(1).max(100),
});

type Token = z.infer<typeof tokenSchema>;

function fmtDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseDate(s: string): Date | null {
  const d = parseISO(s);
  return isValid(d) ? d : null;
}

function base64UrlEncode(input: string): string {
  const b64 = btoa(unescape(encodeURIComponent(input)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return decodeURIComponent(escape(atob(padded)));
}

export function encodeShareState(state: ShareFormState): string {
  const token: Token = {
    v: 1,
    n: state.eventName,
    sd: fmtDate(state.startDate),
    m: state.mode,
    ...(state.mode === "count" && state.numberOfMeetings != null
      ? { c: state.numberOfMeetings }
      : {}),
    ...(state.mode === "endDate" && state.endDate
      ? { ed: fmtDate(state.endDate) }
      : {}),
    d: state.selectedDays,
    st: state.startTime,
    et: state.endTime,
    h: state.holidays.map(fmtDate),
    ...(state.location ? { l: state.location } : {}),
    ...(state.notes ? { nt: state.notes } : {}),
    r: state.reminderMinutes,
    tz: state.timezone,
  };
  return base64UrlEncode(JSON.stringify(token));
}

export function decodeShareState(token: string): ShareFormState | null {
  try {
    const json = base64UrlDecode(token);
    const parsed = tokenSchema.parse(JSON.parse(json));
    const startDate = parseDate(parsed.sd);
    if (!startDate) return null;

    let endDate: Date | undefined;
    if (parsed.m === "endDate") {
      if (!parsed.ed) return null;
      const ed = parseDate(parsed.ed);
      if (!ed) return null;
      endDate = ed;
    }
    if (parsed.m === "count" && parsed.c == null) return null;

    const holidays: Date[] = [];
    for (const s of parsed.h) {
      const d = parseDate(s);
      if (!d) return null;
      holidays.push(d);
    }

    return {
      eventName: parsed.n,
      startDate,
      mode: parsed.m,
      numberOfMeetings: parsed.c,
      endDate,
      selectedDays: parsed.d,
      startTime: parsed.st,
      endTime: parsed.et,
      holidays,
      location: parsed.l,
      notes: parsed.nt,
      reminderMinutes: parsed.r,
      timezone: parsed.tz,
    };
  } catch (e) {
    console.warn("Failed to decode share link", e);
    return null;
  }
}

export function buildShareUrl(state: ShareFormState): string {
  const token = encodeShareState(state);
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#s=${token}`;
}

export function readShareTokenFromHash(): string | null {
  const hash = window.location.hash;
  if (!hash.startsWith("#s=")) return null;
  return hash.slice(3);
}
