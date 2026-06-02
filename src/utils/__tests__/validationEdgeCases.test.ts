import { describe, it, expect, beforeEach } from "vitest";
import {
  validateTimezone,
  validateMeetings,
  validateInterval,
  validateOrdinals,
  validateDaysOfMonth,
  ExportValidationError,
  MAX_MEETINGS,
} from "../validation";
import { generateSchedule, exportToICS } from "../scheduleGenerator";

declare global {
  // eslint-disable-next-line no-var
  var __capturedBlobs: Blob[];
}

function runtimeAcceptsTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

async function lastIcs(): Promise<string> {
  const blob = globalThis.__capturedBlobs.at(-1);
  if (!blob) throw new Error("no blob captured");
  return await blob.text();
}

// =============================================================================
// Timezone edge cases
// =============================================================================
describe("Timezone validation — edge cases", () => {
  it("accepts canonical IANA zones", () => {
    for (const tz of ["UTC", "America/New_York", "Asia/Jakarta", "Pacific/Auckland", "Etc/GMT+12"]) {
      expect(validateTimezone(tz), tz).toBeNull();
    }
  });

  it("accepts legacy aliases that the runtime recognizes", () => {
    const tz = "US/Pacific";
    if (runtimeAcceptsTz(tz)) {
      expect(validateTimezone(tz)).toBeNull();
    } else {
      expect(validateTimezone(tz)).toBe("timezoneInvalid");
    }
  });

  it("rejects injection / control-char payloads", () => {
    const payloads = [
      "UTC\r\nBEGIN:VEVENT",
      "UTC\nDTSTART:19700101T000000Z",
      "UTC\tinjected",
      "\u0000UTC",
      "",
      "   ",
      "x".repeat(65),
    ];
    for (const p of payloads) {
      expect(validateTimezone(p), JSON.stringify(p)).toBe("timezoneInvalid");
    }
  });

  it("rejects unknown / malformed zones", () => {
    for (const tz of ["utc/notreal", "America/Nowhere", "Mars/Olympus_Mons", "UTC; DROP"]) {
      expect(validateTimezone(tz), tz).toBe("timezoneInvalid");
    }
  });
});

// =============================================================================
// ICS round-trip — timezone + DST
// =============================================================================
describe("ICS export — timezone & DST stability", () => {
  beforeEach(() => {
    globalThis.__capturedBlobs = [];
  });

  const singleSession = (date: Date) =>
    generateSchedule({
      startDate: date,
      selectedDays: [date.getDay()],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      mode: "count",
      numberOfMeetings: 1,
    });

  it("UTC export emits Z timestamps and no VTIMEZONE", async () => {
    const sessions = singleSession(new Date(2026, 0, 5));
    exportToICS(sessions, "E", "en", { timezone: "UTC" });
    const text = await lastIcs();
    expect(text).toContain("DTSTART:20260105T090000Z");
    expect(text).not.toContain("VTIMEZONE");
    expect(text).not.toContain("TZID=");
  });

  it("non-UTC export emits floating local time with TZID and VTIMEZONE", async () => {
    const sessions = singleSession(new Date(2026, 0, 5));
    exportToICS(sessions, "E", "en", { timezone: "America/New_York" });
    const text = await lastIcs();
    expect(text).toContain("DTSTART;TZID=America/New_York:20260105T090000");
    expect(text).toContain("DTEND;TZID=America/New_York:20260105T100000");
    expect(text).not.toMatch(/DTSTART;TZID=[^:]+:\d{8}T\d{6}Z/);
    expect(text).toContain("BEGIN:VTIMEZONE");
    expect(text).toContain("TZID:America/New_York");
  });

  it("throws ExportValidationError on injected timezone", () => {
    const sessions = singleSession(new Date(2026, 0, 5));
    expect(() => exportToICS(sessions, "E", "en", { timezone: "UTC\r\nBEGIN:VEVENT" })).toThrow(
      ExportValidationError,
    );
  });

  // Each DST boundary: 09:00 local must stay "T090000" in the ICS string
  // because we serialize as floating local time with TZID.
  const dstCases: Array<{ label: string; tz: string; date: Date }> = [
    { label: "US spring-forward", tz: "America/New_York", date: new Date(2026, 2, 8) },
    { label: "US fall-back", tz: "America/New_York", date: new Date(2026, 10, 1) },
    { label: "EU spring-forward", tz: "Europe/London", date: new Date(2026, 2, 29) },
    { label: "AU autumn transition", tz: "Australia/Sydney", date: new Date(2026, 3, 5) },
  ];
  for (const { label, tz, date } of dstCases) {
    it(`${label} (${tz}) — 09:00 local stays 09:00 in ICS`, async () => {
      const sessions = singleSession(date);
      exportToICS(sessions, "E", "en", { timezone: tz });
      const text = await lastIcs();
      const y = date.getFullYear();
      const mo = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      expect(text).toContain(`DTSTART;TZID=${tz}:${y}${mo}${d}T090000`);
      expect(text).toContain(`DTEND;TZID=${tz}:${y}${mo}${d}T100000`);
    });
  }

  it("weekly schedule crossing US DST keeps every local time at 09:00", async () => {
    // Weekly Sundays around 2026-03-08 spring-forward.
    const sessions = generateSchedule({
      startDate: new Date(2026, 1, 22), // Sun Feb 22
      selectedDays: [0],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      mode: "count",
      numberOfMeetings: 4, // Feb 22, Mar 1, Mar 8, Mar 15
    });
    expect(sessions).toHaveLength(4);
    exportToICS(sessions, "E", "en", { timezone: "America/New_York" });
    const text = await lastIcs();
    const starts = [...text.matchAll(/DTSTART;TZID=America\/New_York:(\d{8}T\d{6})/g)].map(
      (m) => m[1],
    );
    expect(starts).toEqual([
      "20260222T090000",
      "20260301T090000",
      "20260308T090000",
      "20260315T090000",
    ]);
  });

  it("UTC export of a DST-day session matches Date.toISOString()", async () => {
    const date = new Date(2026, 2, 8); // US spring-forward
    const sessions = singleSession(date);
    exportToICS(sessions, "E", "en", { timezone: "UTC" });
    const text = await lastIcs();
    const dt = new Date(date);
    dt.setHours(9, 0, 0, 0);
    const expected = dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    expect(text).toContain(`DTSTART:${expected}`);
  });
});

// =============================================================================
// Meeting frequency patterns
// =============================================================================
describe("Recurrence patterns — weekly", () => {
  it("interval=1 produces consecutive weekly sessions", () => {
    const sessions = generateSchedule({
      startDate: new Date(2026, 0, 5), // Mon
      selectedDays: [1],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "weekly", interval: 1 },
      mode: "count",
      numberOfMeetings: 4,
    });
    expect(sessions.map((s) => s.date.getDate())).toEqual([5, 12, 19, 26]);
  });

  it.each([2, 3, 4, 12])("interval=%i spaces sessions by that many weeks", (interval) => {
    const sessions = generateSchedule({
      startDate: new Date(2026, 0, 5),
      selectedDays: [1],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "weekly", interval },
      mode: "count",
      numberOfMeetings: 3,
    });
    expect(sessions).toHaveLength(3);
    const diffDays = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
    expect(diffDays(sessions[0].date, sessions[1].date)).toBe(7 * interval);
    expect(diffDays(sessions[1].date, sessions[2].date)).toBe(7 * interval);
  });

  it("multiple weekdays + interval=2 only fires in matching weeks", () => {
    const sessions = generateSchedule({
      startDate: new Date(2026, 0, 5), // Mon
      selectedDays: [1, 3], // Mon + Wed
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "weekly", interval: 2 },
      mode: "count",
      numberOfMeetings: 6,
    });
    // Weeks: Jan 5–11 (Mon 5, Wed 7), skip 12–18, Jan 19–25 (19, 21), skip, Feb 2–8 (2, 4)
    expect(sessions.map((s) => s.date.toISOString().slice(0, 10))).toEqual([
      "2026-01-05",
      "2026-01-07",
      "2026-01-19",
      "2026-01-21",
      "2026-02-02",
      "2026-02-04",
    ]);
  });
});

describe("Recurrence patterns — monthly by weekday", () => {
  it("1st Monday of each month for 6 months", () => {
    const sessions = generateSchedule({
      startDate: new Date(2026, 0, 1),
      selectedDays: [1],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "monthlyByWeekday", ordinals: [1] },
      mode: "count",
      numberOfMeetings: 6,
    });
    expect(sessions.map((s) => s.date.toISOString().slice(0, 10))).toEqual([
      "2026-01-05",
      "2026-02-02",
      "2026-03-02",
      "2026-04-06",
      "2026-05-04",
      "2026-06-01",
    ]);
  });

  it("last Friday of each month (-1 ordinal)", () => {
    const sessions = generateSchedule({
      startDate: new Date(2026, 0, 1),
      selectedDays: [5],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "monthlyByWeekday", ordinals: [-1] },
      mode: "count",
      numberOfMeetings: 4,
    });
    expect(sessions.map((s) => s.date.toISOString().slice(0, 10))).toEqual([
      "2026-01-30",
      "2026-02-27",
      "2026-03-27",
      "2026-04-24",
    ]);
  });

  it("multiple ordinals [1,3] produce two sessions per month", () => {
    const sessions = generateSchedule({
      startDate: new Date(2026, 0, 1),
      selectedDays: [1],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "monthlyByWeekday", ordinals: [1, 3] },
      mode: "count",
      numberOfMeetings: 4,
    });
    expect(sessions).toHaveLength(4);
    expect(sessions.map((s) => s.date.toISOString().slice(0, 10))).toEqual([
      "2026-01-05",
      "2026-01-19",
      "2026-02-02",
      "2026-02-16",
    ]);
  });
});

describe("Recurrence patterns — monthly by date", () => {
  it("days [1, 15] of each month", () => {
    const sessions = generateSchedule({
      startDate: new Date(2026, 0, 1),
      selectedDays: [],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "monthlyByDate", daysOfMonth: [1, 15] },
      mode: "count",
      numberOfMeetings: 4,
    });
    expect(sessions.map((s) => s.date.toISOString().slice(0, 10))).toEqual([
      "2026-01-01",
      "2026-01-15",
      "2026-02-01",
      "2026-02-15",
    ]);
  });

  it("last-day (-1) collapses to actual month length, including leap Feb", () => {
    const sessions = generateSchedule({
      startDate: new Date(2024, 0, 1), // 2024 is a leap year
      selectedDays: [],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "monthlyByDate", daysOfMonth: [-1] },
      mode: "count",
      numberOfMeetings: 4,
    });
    expect(sessions.map((s) => s.date.toISOString().slice(0, 10))).toEqual([
      "2024-01-31",
      "2024-02-29",
      "2024-03-31",
      "2024-04-30",
    ]);
  });

  it("day 31 clamps to last day in 30-day months", () => {
    const sessions = generateSchedule({
      startDate: new Date(2026, 3, 1), // April (30 days)
      selectedDays: [],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "monthlyByDate", daysOfMonth: [31] },
      mode: "count",
      numberOfMeetings: 3,
    });
    expect(sessions.map((s) => s.date.toISOString().slice(0, 10))).toEqual([
      "2026-04-30", // clamped from 31
      "2026-05-31",
      "2026-06-30", // clamped
    ]);
  });

  it("non-leap February clamps day-29 input to Feb 28", () => {
    const sessions = generateSchedule({
      startDate: new Date(2025, 1, 1), // 2025 is not a leap year
      selectedDays: [],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "monthlyByDate", daysOfMonth: [29] },
      mode: "count",
      numberOfMeetings: 1,
    });
    expect(sessions[0].date.toISOString().slice(0, 10)).toBe("2025-02-28");
  });
});

describe("Generation modes & holidays", () => {
  it("end-date mode stops at or before endDate", () => {
    const sessions = generateSchedule({
      startDate: new Date(2026, 0, 5),
      selectedDays: [1],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      mode: "endDate",
      endDate: new Date(2026, 0, 26),
    });
    expect(sessions.map((s) => s.date.toISOString().slice(0, 10))).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
      "2026-01-26",
    ]);
  });

  it("count mode respects MAX_MEETINGS cap", () => {
    const sessions = generateSchedule({
      startDate: new Date(2026, 0, 5),
      selectedDays: [1, 2, 3, 4, 5],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      mode: "count",
      numberOfMeetings: 10_000,
    });
    expect(sessions.length).toBeLessThanOrEqual(MAX_MEETINGS * 3);
    expect(sessions.length).toBeGreaterThan(0);
  });

  it("holiday skip drops the conflicting date", () => {
    const sessions = generateSchedule({
      startDate: new Date(2026, 0, 5),
      selectedDays: [1],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      holidays: [new Date(2026, 0, 12)],
      holidayBehavior: "skip",
      mode: "count",
      numberOfMeetings: 3,
    });
    const iso = sessions.map((s) => s.date.toISOString().slice(0, 10));
    expect(iso).not.toContain("2026-01-12");
    expect(iso).toEqual(["2026-01-05", "2026-01-19", "2026-01-26"]);
  });

  it("holiday rollForward lands on the next allowed weekday and tags rolledFrom", () => {
    const sessions = generateSchedule({
      startDate: new Date(2026, 0, 5),
      selectedDays: [1], // Mondays only
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      holidays: [new Date(2026, 0, 12)],
      holidayBehavior: "rollForward",
      mode: "count",
      numberOfMeetings: 3,
    });
    const rolled = sessions.find((s) => s.rolledFrom);
    expect(rolled).toBeTruthy();
    // Only Mondays allowed → roll within 14 days lands on next Monday (Jan 19).
    expect(rolled!.date.toISOString().slice(0, 10)).toBe("2026-01-19");
    expect(rolled!.rolledFrom!.toISOString().slice(0, 10)).toBe("2026-01-12");
  });
});

// =============================================================================
// Validator boundary fuzz
// =============================================================================
describe("validateMeetings — boundary fuzz", () => {
  it("accepts 1 and MAX_MEETINGS", () => {
    expect(validateMeetings(1)).toBeNull();
    expect(validateMeetings(MAX_MEETINGS)).toBeNull();
  });

  it("rejects 0, MAX+1, negatives", () => {
    expect(validateMeetings(0)).toBe("meetingsOutOfRange");
    expect(validateMeetings(MAX_MEETINGS + 1)).toBe("meetingsOutOfRange");
    expect(validateMeetings(-1)).toBe("meetingsOutOfRange");
  });

  it("rejects non-integer / non-numeric strings", () => {
    expect(validateMeetings("0")).toBe("meetingsOutOfRange");
    expect(validateMeetings("abc")).toBe("meetingsInvalid");
    expect(validateMeetings("1e2")).toBe("meetingsInvalid"); // scientific not accepted by /^\d+$/
    expect(validateMeetings(NaN)).toBe("meetingsInvalid");
    expect(validateMeetings(Infinity)).toBe("meetingsInvalid");
    expect(validateMeetings(1.5)).toBe("meetingsInvalid");
  });

  it("trims surrounding whitespace from numeric strings", () => {
    expect(validateMeetings("  5  ")).toBeNull();
  });
});

describe("per-track meetings validation", () => {
  it("rejects empty / whitespace-only input", () => {
    expect(validateMeetings("")).toBe("meetingsInvalid");
    expect(validateMeetings("   ")).toBe("meetingsInvalid");
  });

  it("rejects malformed numeric strings", () => {
    expect(validateMeetings("abc")).toBe("meetingsInvalid");
    expect(validateMeetings("1.5")).toBe("meetingsInvalid");
    expect(validateMeetings("-3")).toBe("meetingsInvalid");
    expect(validateMeetings("1e2")).toBe("meetingsInvalid");
    expect(validateMeetings("NaN")).toBe("meetingsInvalid");
  });

  it("rejects out-of-range integer strings", () => {
    expect(validateMeetings("0")).toBe("meetingsOutOfRange");
    expect(validateMeetings("367")).toBe("meetingsOutOfRange");
  });

  it("accepts boundary and padded values", () => {
    expect(validateMeetings("1")).toBeNull();
    expect(validateMeetings("366")).toBeNull();
    expect(validateMeetings("  42  ")).toBeNull();
  });
});

describe("validateInterval — boundary fuzz", () => {
  it.each([1, 2, 6, 12])("accepts %i", (n) => expect(validateInterval(n)).toBeNull());
  it.each([0, -1, 13, 1.5, NaN, Infinity, "2"])("rejects %p", (n) => {
    expect(validateInterval(n)).toBe("intervalInvalid");
  });
});

describe("validateOrdinals & validateDaysOfMonth — duplicates and bad values", () => {
  it("ordinals dedupe before validation", () => {
    expect(validateOrdinals([1, 1, 1])).toBeNull();
    expect(validateOrdinals([1, 2, 3, 4, -1, 1, 2])).toBeNull();
  });
  it("ordinals reject 0, 5, floats, negatives other than -1", () => {
    expect(validateOrdinals([0])).toBe("ordinalsInvalid");
    expect(validateOrdinals([5])).toBe("ordinalsInvalid");
    expect(validateOrdinals([1.5])).toBe("ordinalsInvalid");
    expect(validateOrdinals([-2])).toBe("ordinalsInvalid");
  });
  it("daysOfMonth dedupe, accept -1 and 1..31", () => {
    expect(validateDaysOfMonth([1, 1, 15, 31, -1])).toBeNull();
  });
  it("daysOfMonth reject 0, 32, floats, NaN", () => {
    expect(validateDaysOfMonth([0])).toBe("daysOfMonthInvalid");
    expect(validateDaysOfMonth([32])).toBe("daysOfMonthInvalid");
    expect(validateDaysOfMonth([1.5])).toBe("daysOfMonthInvalid");
    expect(validateDaysOfMonth([NaN])).toBe("daysOfMonthInvalid");
  });
});
