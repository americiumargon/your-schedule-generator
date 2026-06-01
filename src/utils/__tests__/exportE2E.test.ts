import { describe, it, expect, beforeEach } from "vitest";
import {
  generateSchedule,
  exportToCSV,
  exportToICS,
  type Session,
} from "@/utils/scheduleGenerator";
import { buildGoogleCalendarUrl } from "@/utils/googleCalendar";

declare global {
  // eslint-disable-next-line no-var
  var __capturedBlobs: Blob[];
}

async function lastBlobText(): Promise<string> {
  const blob = globalThis.__capturedBlobs.at(-1);
  if (!blob) throw new Error("No blob captured");
  return await blob.text();
}

function lastBlob(): Blob {
  const blob = globalThis.__capturedBlobs.at(-1);
  if (!blob) throw new Error("No blob captured");
  return blob;
}

const EVENT_NAME = "Yoga Bootcamp";

function makeSessions(): Session[] {
  // Mondays & Wednesdays starting 2026-01-05 (Mon), 5 sessions, skip 2026-01-12 (Mon, holiday).
  return generateSchedule({
    startDate: new Date(2026, 0, 5),
    selectedDays: [1, 3],
    timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
    holidays: [new Date(2026, 0, 12)],
    holidayBehavior: "skip",
    mode: "count",
    numberOfMeetings: 5,
  });
}

describe("Export E2E (browser environment)", () => {
  beforeEach(() => {
    globalThis.__capturedBlobs = [];
  });

  it("generates a schedule that skips holidays", () => {
    const sessions = makeSessions();
    expect(sessions).toHaveLength(5);
    const dates = sessions.map((s) => s.date.toISOString().slice(0, 10));
    expect(dates).not.toContain("2026-01-12");
    expect(dates[0]).toBe("2026-01-05");
  });

  it("exports CSV with Google Calendar headers and one row per session", async () => {
    const sessions = makeSessions();
    exportToCSV(sessions, EVENT_NAME, "en");

    const blob = lastBlob();
    expect(blob.type).toBe("text/csv");

    const text = await lastBlobText();
    const lines = text.split("\n");
    expect(lines[0]).toBe(
      'Subject,Start Date,Start Time,End Date,End Time,All Day Event,Description,Location,Private'
    );
    expect(lines).toHaveLength(1 + sessions.length);

    // First data row reflects first session.
    expect(lines[1]).toContain(EVENT_NAME);
    expect(lines[1]).toContain("01/05/2026");
    expect(lines[1]).toContain("9:00 AM");
    expect(lines[1]).toContain("10:00 AM");

    // Holiday must not appear anywhere.
    expect(text).not.toContain("01/12/2026");
  });

  it("exports ICS with one VEVENT per session and valid VCALENDAR envelope", async () => {
    const sessions = makeSessions();
    exportToICS(sessions, EVENT_NAME, "en", { timezone: "UTC" });

    const blob = lastBlob();
    expect(blob.type).toBe("text/calendar");

    const text = await lastBlobText();
    expect(text).toMatch(/^BEGIN:VCALENDAR/);
    expect(text.trimEnd()).toMatch(/END:VCALENDAR$/);

    const vevents = text.match(/BEGIN:VEVENT/g) ?? [];
    expect(vevents).toHaveLength(sessions.length);

    expect(text).toContain(`SUMMARY:${EVENT_NAME} - Session 1`);
    // First session: 2026-01-05 09:00–10:00 UTC.
    expect(text).toContain("DTSTART:20260105T090000Z");
    expect(text).toContain("DTEND:20260105T100000Z");
  });

  it("builds a Google Calendar URL for a single session", () => {
    const sessions = makeSessions().slice(0, 1);
    const result = buildGoogleCalendarUrl(EVENT_NAME, sessions, undefined, undefined, "UTC");

    expect("url" in result && result.url).toBeTruthy();
    if (!result.url) throw new Error("expected URL");

    expect(result.url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
    const params = new URL(result.url).searchParams;
    expect(params.get("action")).toBe("TEMPLATE");
    expect(params.get("text")).toBe(EVENT_NAME);
    expect(params.get("dates")).toBe("20260105T090000Z/20260105T100000Z");
  });

  it("builds a Google Calendar URL with RRULE for a clean recurring schedule", () => {
    // No holiday skips so the result is a representable weekly pattern.
    const sessions = generateSchedule({
      startDate: new Date(2026, 0, 5),
      selectedDays: [1, 3],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      mode: "count",
      numberOfMeetings: 6,
    });
    const result = buildGoogleCalendarUrl(EVENT_NAME, sessions, undefined, undefined, "UTC");

    expect("url" in result && result.url).toBeTruthy();
    if (!result.url) throw new Error("expected URL");

    const params = new URL(result.url).searchParams;
    expect(params.get("text")).toBe(EVENT_NAME);
    const recur = params.get("recur");
    expect(recur).toContain("RRULE:FREQ=WEEKLY");
    expect(recur).toMatch(/BYDAY=[A-Z,]*MO/);
    expect(recur).toMatch(/BYDAY=[A-Z,]*WE/);
  });
});
