import { z } from "zod";
import { format, parseISO, isValid } from "date-fns";
import LZString from "lz-string";
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
  nm: z.number().int().min(1).max(366).optional(),
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

// --- v3 (loose draft, all fields optional, for "Save draft" share links) ---
const looseTimeStr = z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).or(z.literal(""));
const looseSlotSchema = z.object({
  s: looseTimeStr.optional(),
  e: looseTimeStr.optional(),
  l: z.string().max(50).optional(),
});
const draftRecurrenceSchema = z.object({
  t: z.enum(["weekly", "monthlyByWeekday", "monthlyByDate"]).optional(),
  i: z.number().int().min(1).max(12).optional(),
  o: z.array(z.number().int().min(-1).max(5)).optional(),
  dm: z.array(z.number().int().min(-1).max(31)).optional(),
});
const draftTrackSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  n: z.string().max(100).optional(),
  c: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  d: z.array(z.number().int().min(0).max(6)).optional(),
  ts: z.array(looseSlotSchema).max(6).optional(),
  rec: draftRecurrenceSchema.optional(),
  l: z.string().max(200).optional(),
  nt: z.string().max(2000).optional(),
  sd: dateStr.optional(),
  sa: z.string().min(1).max(64).optional(),
  nm: z.number().int().min(1).max(366).optional(),
});
const v3Token = z.object({
  v: z.literal(3),
  pn: z.string().max(100).optional(),
  sd: dateStr.optional(),
  m: z.enum(["count", "endDate"]).optional(),
  c: z.number().int().min(1).max(366).optional(),
  ed: dateStr.optional(),
  h: z.array(dateStr).max(366).optional(),
  hb: z.enum(["skip", "rollForward"]).optional(),
  r: z.number().optional(),
  tz: z.string().max(100).optional(),
  tr: z.array(draftTrackSchema).max(12).optional(),
});

const tokenSchema = z.union([v3Token, v2Token, v1Token]);

/** A partial form state. Used by the "Save draft" flow so users can share an
 *  in-progress form. Decoded drafts come back as ShareFormState with best-effort
 *  defaults for missing fields (e.g. undefined startDate, empty holidays). */
export type DraftFormState = Partial<ShareFormState>;

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

/** Compact, URL-safe encoding. Uses lz-string for ~40-60% shorter share links.
 *  Prefixed with "1" so we can evolve the wire format later. */
function encodeToken(json: string): string {
  return "1" + LZString.compressToEncodedURIComponent(json);
}
/** Decodes new "1…" tokens (lz-string) and falls back to legacy base64url for
 *  links generated before compression was introduced. */
function decodeToken(token: string): string {
  if (token.startsWith("1")) {
    const out = LZString.decompressFromEncodedURIComponent(token.slice(1));
    if (out) return out;
  }
  return b64urlDec(token);
}

function encRec(rec: Recurrence) {
  if (rec.type === "weekly") return { t: "weekly" as const, i: rec.interval };
  if (rec.type === "monthlyByWeekday") return { t: "monthlyByWeekday" as const, o: rec.ordinals };
  return { t: "monthlyByDate" as const, dm: rec.daysOfMonth };
}
function decRec(r: { t?: "weekly" | "monthlyByWeekday" | "monthlyByDate"; i?: number; o?: number[]; dm?: number[] } | undefined): Recurrence {
  if (!r || !r.t) return { type: "weekly", interval: 1 };
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
      ...(t.numberOfMeetings != null ? { nm: t.numberOfMeetings } : {}),
    })),
  };
  return encodeToken(JSON.stringify(token));
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
    numberOfMeetings: parsed.m === "count" ? parsed.c : undefined,
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
    startsAfter: tr.sa,
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

function decodeV3(parsed: z.infer<typeof v3Token>): ShareFormState {
  const startDate = parsed.sd ? parseDate(parsed.sd) ?? undefined : undefined;
  const endDate = parsed.ed ? parseDate(parsed.ed) ?? undefined : undefined;
  const holidays: Date[] = [];
  for (const s of parsed.h ?? []) {
    const d = parseDate(s);
    if (d) holidays.push(d);
  }
  const tracks: Track[] = (parsed.tr ?? []).map((tr, idx) => {
    const slots = (tr.ts && tr.ts.length > 0
      ? tr.ts.map((s) => ({ startTime: s.s ?? "", endTime: s.e ?? "", label: s.l }))
      : [{ startTime: "", endTime: "", label: undefined as string | undefined }]);
    return createTrack({
      id: tr.id,
      name: tr.n,
      color: tr.c,
      selectedDays: tr.d,
      timeSlots: slots,
      recurrence: decRec(tr.rec),
      location: tr.l,
      notes: tr.nt,
      startDate: tr.sd ? parseDate(tr.sd) ?? undefined : undefined,
      startsAfter: tr.sa,
    }, idx);
  });
  // Cast: ShareFormState requires startDate, but ScheduleForm tolerates
  // undefined via its initializer fallbacks. This is the only consumer.
  return {
    projectName: parsed.pn ?? "",
    startDate: startDate as Date,
    mode: parsed.m ?? "count",
    numberOfMeetings: parsed.c,
    endDate,
    holidays,
    holidayBehavior: (parsed.hb ?? "skip") as HolidayBehavior,
    reminderMinutes: parsed.r ?? 0,
    timezone: parsed.tz ?? "",
    tracks,
  };
}

export function decodeShareState(token: string): ShareFormState | null {
  try {
    const json = decodeToken(token);
    const parsed = tokenSchema.parse(JSON.parse(json));
    if (parsed.v === 3) return decodeV3(parsed);
    if (parsed.v === 2) return decodeV2(parsed);
    return decodeV1(parsed);
  } catch (e) {
    console.warn("Failed to decode share link", e);
    return null;
  }
}

export function encodeDraftState(state: DraftFormState): string {
  const fmtIf = (d: Date | undefined) => (d ? fmtDate(d) : undefined);
  const token: Record<string, unknown> = { v: 3 };
  if (state.projectName) token.pn = state.projectName;
  if (state.startDate) token.sd = fmtIf(state.startDate);
  if (state.mode) token.m = state.mode;
  if (state.mode === "count" && state.numberOfMeetings != null) token.c = state.numberOfMeetings;
  if (state.mode === "endDate" && state.endDate) token.ed = fmtIf(state.endDate);
  if (state.holidays && state.holidays.length > 0) token.h = state.holidays.map(fmtDate);
  if (state.holidayBehavior && state.holidayBehavior !== "skip") token.hb = state.holidayBehavior;
  if (state.reminderMinutes != null && state.reminderMinutes !== 0) token.r = state.reminderMinutes;
  if (state.timezone) token.tz = state.timezone;
  if (state.tracks && state.tracks.length > 0) {
    token.tr = state.tracks.map((t) => {
      const tr: Record<string, unknown> = {};
      if (t.id) tr.id = t.id;
      if (t.name) tr.n = t.name;
      if (t.color) tr.c = t.color;
      if (t.selectedDays && t.selectedDays.length > 0) tr.d = t.selectedDays;
      if (t.timeSlots && t.timeSlots.length > 0) {
        tr.ts = t.timeSlots.map((s) => {
          const slot: Record<string, unknown> = {};
          if (s.startTime) slot.s = s.startTime;
          if (s.endTime) slot.e = s.endTime;
          if (s.label) slot.l = s.label;
          return slot;
        });
      }
      if (t.recurrence) tr.rec = encRec(t.recurrence);
      if (t.location) tr.l = t.location;
      if (t.notes) tr.nt = t.notes;
      if (t.startDate) tr.sd = fmtDate(t.startDate);
      if (t.startsAfter) tr.sa = t.startsAfter;
      return tr;
    });
  }
  return encodeToken(JSON.stringify(token));
}

export function buildShareUrl(state: ShareFormState): string {
  const token = encodeShareState(state);
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#s=${token}`;
}

export function buildDraftUrl(state: DraftFormState): string {
  const token = encodeDraftState(state);
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#s=${token}`;
}

export function readShareTokenFromHash(): string | null {
  const hash = window.location.hash;
  if (!hash.startsWith("#s=")) return null;
  return hash.slice(3);
}
