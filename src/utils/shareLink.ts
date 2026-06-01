import { z } from "zod";
import { format, parseISO, isValid } from "date-fns";
import { createTrack, type ProjectState, type Track } from "./tracks";
import type { TimeSlot, Recurrence, HolidayBehavior } from "./scheduleGenerator";

export type ShareMode = "count" | "endDate";

// Public shared type used across app for "the form's state".
export type ShareFormState = ProjectState;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeStr = z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/);

const slotSchema = z.object({
  s: timeStr,
  e: timeStr,
  l: z.string().max(50).optional(),
});

const recurrenceSchema = z.object({
  t: z.enum(["weekly", "monthlyByWeekday", "monthlyByDate"]),
  i: z.number().int().min(1).max(12).optional(),
  o: z.array(z.number().int().min(-1).max(5)).optional(),
  dm: z.array(z.number().int().min(-1).max(31)).optional(),
});

// --- v1 (legacy single-track) ---
const v1Token = z.object({
  v: z.literal(1),
  n: z.string().min(1).max(100),
  sd: dateStr,
  m: z.enum(["count", "endDate"]),
  c: z.number().int().min(1).max(366).optional(),
  ed: dateStr.optional(),
  d: z.array(z.number().int().min(0).max(6)),
  ts: z.array(slotSchema).min(1).max(6).optional(),
  st: timeStr.optional(),
  et: timeStr.optional(),
  h: z.array(dateStr).max(366),
  hb: z.enum(["skip", "rollForward"]).optional(),
  rec: recurrenceSchema.optional(),
  l: z.string().max(200).optional(),
  nt: z.string().max(2000).optional(),
  r: z.number().refine((v) => [0, 5, 15, 30, 60, 1440].includes(v)),
  tz: z.string().min(1).max(100),
});

// --- v2 (project with tracks) ---
const trackSchema = z.object({
  id: z.string().min(1).max(64),
  n: z.string().min(1).max(100),
  c: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  d: z.array(z.number().int().min(0).max(6)),
  ts: z.array(slotSchema).min(1).max(6),
  rec: recurrenceSchema,
  l: z.string().max(200).optional(),
  nt: z.string().max(2000).optional(),
  sd: dateStr.optional(),
  sa: z.string().min(1).max(64).optional(),
});

const v2Token = z.object({
  v: z.literal(2),
  pn: z.string().min(1).max(100),
  sd: dateStr,
  m: z.enum(["count", "endDate"]),
  c: z.number().int().min(1).max(366).optional(),
  ed: dateStr.optional(),
  h: z.array(dateStr).max(366),
  hb: z.enum(["skip", "rollForward"]).optional(),
  r: z.number().refine((v) => [0, 5, 15, 30, 60, 1440].includes(v)),
  tz: z.string().min(1).max(100),
  tr: z.array(trackSchema).min(1).max(12),
});

const tokenSchema = z.union([v2Token, v1Token]);

function fmtDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}
function parseDate(s: string): Date | null {
  const d = parseISO(s);
  return isValid(d) ? d : null;
}
function b64urlEnc(s: string): string {
  const b = btoa(unescape(encodeURIComponent(s)));
  return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDec(s: string): string {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  const p = b + "=".repeat((4 - (b.length % 4)) % 4);
  return decodeURIComponent(escape(atob(p)));
}

function encRec(rec: Recurrence) {
  if (rec.type === "weekly") return { t: "weekly" as const, i: rec.interval };
  if (rec.type === "monthlyByWeekday") return { t: "monthlyByWeekday" as const, o: rec.ordinals };
  return { t: "monthlyByDate" as const, dm: rec.daysOfMonth };
}
function decRec(r: z.infer<typeof recurrenceSchema> | undefined): Recurrence {
  if (!r) return { type: "weekly", interval: 1 };
  if (r.t === "weekly") return { type: "weekly", interval: r.i ?? 1 };
  if (r.t === "monthlyByWeekday") return { type: "monthlyByWeekday", ordinals: r.o ?? [1] };
  return { type: "monthlyByDate", daysOfMonth: r.dm ?? [1] };
}

export function encodeShareState(state: ShareFormState): string {
  const token = {
    v: 2 as const,
    pn: state.projectName,
    sd: fmtDate(state.startDate),
    m: state.mode,
    ...(state.mode === "count" && state.numberOfMeetings != null ? { c: state.numberOfMeetings } : {}),
    ...(state.mode === "endDate" && state.endDate ? { ed: fmtDate(state.endDate) } : {}),
    h: state.holidays.map(fmtDate),
    ...(state.holidayBehavior && state.holidayBehavior !== "skip" ? { hb: state.holidayBehavior } : {}),
    r: state.reminderMinutes,
    tz: state.timezone,
    tr: state.tracks.map((t) => ({
      id: t.id,
      n: t.name,
      c: t.color,
      d: t.selectedDays,
      ts: t.timeSlots.map((s) => ({ s: s.startTime, e: s.endTime, ...(s.label ? { l: s.label } : {}) })),
      rec: encRec(t.recurrence),
      ...(t.location ? { l: t.location } : {}),
      ...(t.notes ? { nt: t.notes } : {}),
      ...(t.startDate ? { sd: fmtDate(t.startDate) } : {}),
      ...(t.startsAfter ? { sa: t.startsAfter } : {}),
    })),
  };
  return b64urlEnc(JSON.stringify(token));
}

function decodeV1(parsed: z.infer<typeof v1Token>): ShareFormState | null {
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
  let timeSlots: TimeSlot[];
  if (parsed.ts && parsed.ts.length > 0) {
    timeSlots = parsed.ts.map((s) => ({ startTime: s.s, endTime: s.e, label: s.l }));
  } else if (parsed.st && parsed.et) {
    timeSlots = [{ startTime: parsed.st, endTime: parsed.et }];
  } else {
    return null;
  }
  const track = createTrack({
    name: parsed.n,
    selectedDays: parsed.d,
    timeSlots,
    recurrence: decRec(parsed.rec),
    location: parsed.l,
    notes: parsed.nt,
  });
  return {
    projectName: parsed.n,
    startDate,
    mode: parsed.m,
    numberOfMeetings: parsed.c,
    endDate,
    holidays,
    holidayBehavior: (parsed.hb ?? "skip") as HolidayBehavior,
    reminderMinutes: parsed.r,
    timezone: parsed.tz,
    tracks: [track],
  };
}

function decodeV2(parsed: z.infer<typeof v2Token>): ShareFormState | null {
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
  const tracks: Track[] = parsed.tr.map((tr) => ({
    id: tr.id,
    name: tr.n,
    color: tr.c,
    selectedDays: tr.d,
    timeSlots: tr.ts.map((s) => ({ startTime: s.s, endTime: s.e, label: s.l })),
    recurrence: decRec(tr.rec),
    location: tr.l,
    notes: tr.nt,
    startDate: tr.sd ? parseDate(tr.sd) ?? undefined : undefined,
  }));
  return {
    projectName: parsed.pn,
    startDate,
    mode: parsed.m,
    numberOfMeetings: parsed.c,
    endDate,
    holidays,
    holidayBehavior: (parsed.hb ?? "skip") as HolidayBehavior,
    reminderMinutes: parsed.r,
    timezone: parsed.tz,
    tracks,
  };
}

export function decodeShareState(token: string): ShareFormState | null {
  try {
    const json = b64urlDec(token);
    const parsed = tokenSchema.parse(JSON.parse(json));
    if (parsed.v === 2) return decodeV2(parsed);
    return decodeV1(parsed);
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
