import { describe, it, expect, beforeEach } from "vitest";
import JSZip from "jszip";
import { exportToCSV, exportToICS, type Session } from "@/utils/scheduleGenerator";
import { exportPerTrackZip } from "@/utils/perTrackExport";
import type { Track } from "@/utils/tracks";
import en from "@/locales/en.json";

function t(key: string, opts?: Record<string, unknown>): string {
  const parts = key.split(".");
  let cur: unknown = en;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return key;
    }
  }
  let out = typeof cur === "string" ? cur : key;
  if (opts) {
    for (const [k, v] of Object.entries(opts)) {
      out = out.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), String(v));
    }
  }
  return out;
}

function makeFixture() {
  const tracks: Track[] = [
    {
      id: "tA",
      name: "Beginner",
      color: "#0ea5e9",
      selectedDays: [1, 3],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "weekly", interval: 1 },
    },
    {
      id: "tB",
      name: "Advanced",
      color: "#ef4444",
      selectedDays: [2, 4],
      timeSlots: [{ startTime: "18:00", endTime: "19:30" }],
      recurrence: { type: "weekly", interval: 1 },
    },
  ];
  const mk = (track: Track, dates: string[], start: string, end: string): Session[] =>
    dates.map((d, i) => ({
      date: new Date(`${d}T00:00:00`),
      sessionNumber: i + 1,
      startTime: start,
      endTime: end,
      trackId: track.id,
      trackName: track.name,
      trackColor: track.color,
    }));
  const beg = mk(tracks[0], ["2026-01-05", "2026-01-07", "2026-01-12", "2026-01-14"], "09:00", "10:00");
  const adv = mk(tracks[1], ["2026-01-06", "2026-01-08", "2026-01-13", "2026-01-15"], "18:00", "19:30");
  const all = [...beg, ...adv].map((s, i) => ({ ...s, sessionNumber: i + 1 }));
  return { tracks, beg, adv, all, byTrack: { tA: beg, tB: adv } };
}

async function last(): Promise<Blob> {
  const arr = globalThis.__capturedBlobs;
  expect(arr.length).toBeGreaterThan(0);
  return arr[arr.length - 1];
}

beforeEach(() => {
  globalThis.__capturedBlobs = [];
});

describe("CSV export — Combined scope", () => {
  it("emits a Google-Calendar-shaped CSV with a Class column", async () => {
    const { all } = makeFixture();
    exportToCSV(all, "QA Term", "en", { includeTrackColumn: true });

    const blob = await last();
    expect(blob.type).toMatch(/csv/);
    const text = await blob.text();
    const lines = text.split("\n");
    expect(lines[0]).toBe(
      '"Subject","Start Date","Start Time","End Date","End Time","All Day Event","Description","Location","Private","Class"',
    );
    // 1 header + 8 data rows
    expect(lines).toHaveLength(9);
    expect(text).toContain("09:00 AM");
    expect(text).toContain("06:00 PM");
    expect(text).toContain('"Beginner"');
    expect(text).toContain('"Advanced"');
  });

  it("neutralizes formula-injection in notes", async () => {
    const { all } = makeFixture();
    const tainted = all.map((s, i) =>
      i === 0 ? { ...s, notes: "=cmd|' /C calc'!A0" } : s,
    );
    exportToCSV(tainted, "QA Term", "en", { includeTrackColumn: true });
    const text = await (await last()).text();
    // Leading '=' should be prefixed with a single quote inside the quoted CSV cell.
    expect(text).toContain("'=cmd");
  });
});

describe("ICS export — Combined scope", () => {
  it("emits a valid VCALENDAR with one VEVENT per session", async () => {
    const { all } = makeFixture();
    exportToICS(all, "QA Term", "en", { timezone: "UTC" });

    const blob = await last();
    expect(blob.type).toMatch(/calendar/);
    const text = await blob.text();
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("END:VCALENDAR");
    const events = text.match(/BEGIN:VEVENT/g) ?? [];
    expect(events).toHaveLength(8);
    expect(text).toContain("[Beginner]");
    expect(text).toContain("[Advanced]");
    expect(text).toMatch(/DTSTART:\d{8}T0[29]0000Z/); // 09:00 local serialized as UTC
    expect(text).toMatch(/DTSTART:\d{8}T1[18]0000Z/); // 18:00 local serialized as UTC
  });
});

describe("CSV export — Per-track ZIP scope", () => {
  it("emits one CSV per track inside the zip, with only that track's sessions", async () => {
    const { tracks, byTrack } = makeFixture();
    await exportPerTrackZip(byTrack, tracks, "QA Term", "csv", {}, {}, t, "en");

    const zip = await JSZip.loadAsync(await (await last()).arrayBuffer());
    const names = Object.keys(zip.files);
    const begName = names.find((n) => /Beginner.*\.csv$/.test(n));
    const advName = names.find((n) => /Advanced.*\.csv$/.test(n));
    expect(begName, names.join(", ")).toBeDefined();
    expect(advName, names.join(", ")).toBeDefined();

    const begText = await zip.file(begName!)!.async("text");
    const advText = await zip.file(advName!)!.async("text");

    expect(begText.split("\n")).toHaveLength(5); // 1 header + 4 rows
    expect(advText.split("\n")).toHaveLength(5);

    expect(begText).toContain("09:00 AM");
    expect(begText).not.toContain("06:00 PM");
    expect(advText).toContain("06:00 PM");
    expect(advText).not.toContain("09:00 AM");

    // Per-track CSV files are single-track and do not include a Class column.
    expect(begText.split("\n")[0]).not.toContain("Class");
    expect(advText.split("\n")[0]).not.toContain("Class");
  });
});

describe("ICS export — Per-track ZIP scope", () => {
  it("emits one ICS per track inside the zip, isolated by track", async () => {
    const { tracks, byTrack } = makeFixture();
    await exportPerTrackZip(byTrack, tracks, "QA Term", "ics", { timezone: "UTC" }, {}, t, "en");

    const zip = await JSZip.loadAsync(await (await last()).arrayBuffer());
    const names = Object.keys(zip.files);
    const begName = names.find((n) => /Beginner.*\.ics$/.test(n));
    const advName = names.find((n) => /Advanced.*\.ics$/.test(n));
    expect(begName, names.join(", ")).toBeDefined();
    expect(advName, names.join(", ")).toBeDefined();

    for (const [name, mustMatch, mustNotMatch] of [
      [begName!, /T0[29]0000Z/, /T1[18]0000Z/],
      [advName!, /T1[18]0000Z/, /T0[29]0000Z/],
    ] as const) {
      const text = await zip.file(name)!.async("text");
      expect(text).toContain("BEGIN:VCALENDAR");
      expect(text).toContain("END:VCALENDAR");
      const events = text.match(/BEGIN:VEVENT/g) ?? [];
      expect(events).toHaveLength(4);
      expect(text).toMatch(mustMatch);
      expect(text).not.toMatch(mustNotMatch);
    }
  });
});
