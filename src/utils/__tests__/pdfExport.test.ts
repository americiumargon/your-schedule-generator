import { describe, it, expect, beforeEach } from "vitest";
import JSZip from "jszip";
import { exportToPDF } from "@/utils/pdfExport";
import { exportPerTrackZip } from "@/utils/perTrackExport";
import type { Session } from "@/utils/scheduleGenerator";
import type { Track } from "@/utils/tracks";
import en from "@/locales/en.json";

// Minimal i18n-like resolver against the English bundle.
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

function makeSessions(): { sessions: Session[]; tracks: Track[]; byTrack: Record<string, Session[]> } {
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

  // 4 sessions per track, deterministic dates.
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
  return { sessions: all, tracks, byTrack: { tA: beg, tB: adv } };
}

async function blobBytes(b: Blob): Promise<Uint8Array> {
  return new Uint8Array(await b.arrayBuffer());
}

function bytesToLatin1(u8: Uint8Array): string {
  // Reconstruct a latin1 string for substring matching.
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return s;
}

beforeEach(() => {
  globalThis.__capturedBlobs = [];
});

describe("PDF export — Combined scope", () => {
  it("produces a single PDF with all tracks and a Track column", async () => {
    const { sessions } = makeSessions();
    exportToPDF(
      sessions,
      "QA Term",
      "en",
      { includeTrackColumn: true, filename: "QA_Term" },
      { accentColor: "#0ea5e9", orgName: "QA Org" },
      t,
    );

    expect(globalThis.__capturedBlobs.length).toBeGreaterThanOrEqual(1);
    const pdfBlob = globalThis.__capturedBlobs[globalThis.__capturedBlobs.length - 1];
    expect(pdfBlob.type).toMatch(/pdf/);
    const bytes = await blobBytes(pdfBlob);
    expect(bytes.length).toBeGreaterThan(1024);
    expect(bytesToLatin1(bytes.subarray(0, 8))).toContain("%PDF-");

    const text = bytesToLatin1(bytes);
    for (const needle of ["QA Term", "Beginner", "Advanced", "09:00", "18:00"]) {
      expect(text, `expected combined PDF to contain ${needle}`).toContain(needle);
    }
  });

  it("produces a larger PDF when coverPage is enabled (extra cover page)", async () => {
    const { sessions } = makeSessions();
    const tinyPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

    exportToPDF(
      sessions,
      "QA Term",
      "en",
      { includeTrackColumn: true, filename: "no_cover" },
      { accentColor: "#0ea5e9", orgName: "QA Org", logoDataUrl: tinyPng, coverPage: false },
      t,
    );
    const noCoverBlob = globalThis.__capturedBlobs[globalThis.__capturedBlobs.length - 1];
    const noCoverBytes = await blobBytes(noCoverBlob);

    exportToPDF(
      sessions,
      "QA Term",
      "en",
      { includeTrackColumn: true, filename: "with_cover" },
      { accentColor: "#0ea5e9", orgName: "QA Org", logoDataUrl: tinyPng, coverPage: true },
      t,
    );
    const coverBlob = globalThis.__capturedBlobs[globalThis.__capturedBlobs.length - 1];
    const coverBytes = await blobBytes(coverBlob);

    expect(coverBytes.length).toBeGreaterThan(noCoverBytes.length);
    expect(bytesToLatin1(coverBytes)).toContain("QA Org");
  });

  it("does not throw when logo and org name are absent (cover suppressed)", () => {
    const { sessions } = makeSessions();
    expect(() =>
      exportToPDF(
        sessions,
        "QA Term",
        "en",
        { includeTrackColumn: true, filename: "no_brand" },
        { accentColor: "#0ea5e9" },
        t,
      ),
    ).not.toThrow();
  });

  it("does not log a column-width overflow warning with long location + notes", async () => {
    const { sessions } = makeSessions();
    const longLoc = "Building 7, Wing C, Room 412B, North Campus Annex";
    const longNotes = "Bring laptop, charger, notebook, and pre-read chapter 3 before arriving on time.";
    const withText = sessions.map((s) => ({ ...s, location: longLoc, notes: longNotes }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      exportToPDF(
        withText,
        "QA Term",
        "en",
        { includeTrackColumn: true, filename: "wide" },
        { accentColor: "#0ea5e9", orgName: "QA Org" },
        t,
      );
      const overflowed = logSpy.mock.calls.some((args) =>
        args.some((a) => typeof a === "string" && /could not fit page/i.test(a)),
      );
      expect(overflowed).toBe(false);
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe("PDF export — One file per track ZIP scope", () => {
  it("produces a zip with one PDF per track, each containing only its own track", async () => {
    const { tracks, byTrack } = makeSessions();
    await exportPerTrackZip(
      byTrack,
      tracks,
      "QA Term",
      "pdf",
      {},
      { accentColor: "#0ea5e9", orgName: "QA Org" },
      t,
      "en",
    );

    // Last captured blob should be the zip download.
    const zipBlob = globalThis.__capturedBlobs[globalThis.__capturedBlobs.length - 1];
    expect(zipBlob).toBeDefined();
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());

    const names = Object.keys(zip.files);
    const beginnerEntry = names.find((n) => /Beginner.*\.pdf$/.test(n));
    const advancedEntry = names.find((n) => /Advanced.*\.pdf$/.test(n));
    expect(beginnerEntry, `entries: ${names.join(", ")}`).toBeDefined();
    expect(advancedEntry, `entries: ${names.join(", ")}`).toBeDefined();

    const begBytes = await zip.file(beginnerEntry!)!.async("uint8array");
    const advBytes = await zip.file(advancedEntry!)!.async("uint8array");
    expect(begBytes.length).toBeGreaterThan(1024);
    expect(advBytes.length).toBeGreaterThan(1024);

    const begText = bytesToLatin1(begBytes);
    const advText = bytesToLatin1(advBytes);

    expect(begText).toContain("Beginner");
    expect(begText).not.toContain("Advanced");

    expect(advText).toContain("Advanced");
    expect(advText).not.toContain("Beginner");
  });
});
