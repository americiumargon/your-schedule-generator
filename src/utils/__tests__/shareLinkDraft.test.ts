import { describe, expect, it } from "vitest";
import LZString from "lz-string";
import {
  encodeDraftState,
  encodeShareState,
  decodeShareState,
  type DraftFormState,
  type ShareFormState,
} from "../shareLink";

describe("share link drafts (v3)", () => {
  it("encodes an empty draft and decodes back without throwing", () => {
    const token = encodeDraftState({});
    const decoded = decodeShareState(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.projectName).toBe("");
    expect(decoded!.startDate).toBeUndefined();
    expect(decoded!.holidays).toEqual([]);
    expect(decoded!.tracks).toEqual([]);
  });

  it("round-trips a partial draft (name + startDate only)", () => {
    const draft: DraftFormState = {
      projectName: "My yoga class",
      startDate: new Date(2026, 5, 1),
    };
    const decoded = decodeShareState(encodeDraftState(draft));
    expect(decoded).not.toBeNull();
    expect(decoded!.projectName).toBe("My yoga class");
    expect(decoded!.startDate?.getFullYear()).toBe(2026);
    expect(decoded!.numberOfMeetings).toBeUndefined();
    expect(decoded!.endDate).toBeUndefined();
  });

  it("round-trips a draft with a partial track (empty times allowed)", () => {
    const draft: DraftFormState = {
      projectName: "WIP",
      mode: "count",
      numberOfMeetings: 5,
      tracks: [
        {
          id: "t1",
          name: "Group A",
          color: "#0ea5e9",
          selectedDays: [1, 3],
          timeSlots: [{ startTime: "", endTime: "" }],
          recurrence: { type: "weekly", interval: 1 },
        },
      ],
    };
    const decoded = decodeShareState(encodeDraftState(draft));
    expect(decoded).not.toBeNull();
    expect(decoded!.tracks).toHaveLength(1);
    expect(decoded!.tracks[0].name).toBe("Group A");
    expect(decoded!.tracks[0].selectedDays).toEqual([1, 3]);
    expect(decoded!.tracks[0].timeSlots[0].startTime).toBe("");
  });

  it("still decodes a fully-valid v2 share token (regression)", () => {
    const full: ShareFormState = {
      projectName: "Full",
      startDate: new Date(2026, 0, 5),
      mode: "count",
      numberOfMeetings: 4,
      holidays: [],
      holidayBehavior: "skip",
      reminderMinutes: 0,
      timezone: "UTC",
      tracks: [
        {
          id: "t1",
          name: "Class",
          color: "#0ea5e9",
          selectedDays: [1],
          timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
          recurrence: { type: "weekly", interval: 1 },
        },
      ],
    };
    const decoded = decodeShareState(encodeShareState(full));
    expect(decoded).not.toBeNull();
    expect(decoded!.projectName).toBe("Full");
    expect(decoded!.tracks[0].timeSlots[0].startTime).toBe("09:00");
  });

  it("hydrates per-track numberOfMeetings from legacy project-level count on v2 links", () => {
    // Build a v2 token by hand (without per-track nm) to simulate older share links.
    const legacy: ShareFormState = {
      projectName: "Legacy",
      startDate: new Date(2026, 0, 5),
      mode: "count",
      numberOfMeetings: 7,
      holidays: [],
      holidayBehavior: "skip",
      reminderMinutes: 0,
      timezone: "UTC",
      tracks: [
        {
          id: "t1",
          name: "Group A",
          color: "#0ea5e9",
          selectedDays: [1],
          timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
          recurrence: { type: "weekly", interval: 1 },
          // no numberOfMeetings → encodeShareState omits nm
        },
        {
          id: "t2",
          name: "Group B",
          color: "#22c55e",
          selectedDays: [3],
          timeSlots: [{ startTime: "11:00", endTime: "12:00" }],
          recurrence: { type: "weekly", interval: 1 },
        },
      ],
    };
    const decoded = decodeShareState(encodeShareState(legacy));
    expect(decoded).not.toBeNull();
    expect(decoded!.tracks[0].numberOfMeetings).toBe(7);
    expect(decoded!.tracks[1].numberOfMeetings).toBe(7);
  });

  it("round-trips per-track numberOfMeetings on v2 links", () => {
    const full: ShareFormState = {
      projectName: "Per-track",
      startDate: new Date(2026, 0, 5),
      mode: "count",
      holidays: [],
      holidayBehavior: "skip",
      reminderMinutes: 0,
      timezone: "UTC",
      tracks: [
        {
          id: "t1",
          name: "A",
          color: "#0ea5e9",
          selectedDays: [1],
          timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
          recurrence: { type: "weekly", interval: 1 },
          numberOfMeetings: 3,
        },
        {
          id: "t2",
          name: "B",
          color: "#22c55e",
          selectedDays: [3],
          timeSlots: [{ startTime: "11:00", endTime: "12:00" }],
          recurrence: { type: "weekly", interval: 1 },
          numberOfMeetings: 6,
        },
      ],
    };
    const decoded = decodeShareState(encodeShareState(full));
    expect(decoded).not.toBeNull();
    expect(decoded!.tracks[0].numberOfMeetings).toBe(3);
    expect(decoded!.tracks[1].numberOfMeetings).toBe(6);
  });
});

describe("share link per-group session counts", () => {
  function mkTrack(id: string, name: string, color: string, count?: number) {
    return {
      id,
      name,
      color,
      selectedDays: [1] as number[],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "weekly" as const, interval: 1 },
      ...(count != null ? { numberOfMeetings: count } : {}),
    };
  }

  it("round-trips three tracks with distinct counts and preserves other fields", () => {
    const state: ShareFormState = {
      projectName: "Three groups",
      startDate: new Date(2026, 0, 5),
      mode: "count",
      holidays: [],
      holidayBehavior: "skip",
      reminderMinutes: 0,
      timezone: "UTC",
      tracks: [
        mkTrack("t1", "Alpha", "#0ea5e9", 4),
        mkTrack("t2", "Beta", "#22c55e", 11),
        mkTrack("t3", "Gamma", "#f59e0b", 33),
      ],
    };
    const decoded = decodeShareState(encodeShareState(state));
    expect(decoded).not.toBeNull();
    expect(decoded!.tracks.map((t) => t.numberOfMeetings)).toEqual([4, 11, 33]);
    expect(decoded!.tracks.map((t) => t.name)).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(decoded!.tracks.map((t) => t.color)).toEqual(["#0ea5e9", "#22c55e", "#f59e0b"]);
    expect(decoded!.tracks[0].selectedDays).toEqual([1]);
    expect(decoded!.tracks[0].timeSlots[0]).toMatchObject({ startTime: "09:00", endTime: "10:00" });
    expect(decoded!.tracks[0].recurrence).toEqual({ type: "weekly", interval: 1 });
  });

  it("mixes per-track count + legacy project-level fallback on the same link", () => {
    const state: ShareFormState = {
      projectName: "Mixed",
      startDate: new Date(2026, 0, 5),
      mode: "count",
      numberOfMeetings: 12, // legacy fallback for tracks without nm
      holidays: [],
      holidayBehavior: "skip",
      reminderMinutes: 0,
      timezone: "UTC",
      tracks: [
        mkTrack("t1", "A", "#0ea5e9", 5),
        mkTrack("t2", "B", "#22c55e"), // no per-track count
      ],
    };
    const decoded = decodeShareState(encodeShareState(state));
    expect(decoded).not.toBeNull();
    expect(decoded!.tracks[0].numberOfMeetings).toBe(5);
    expect(decoded!.tracks[1].numberOfMeetings).toBe(12);
  });

  it("round-trips boundary counts 1 and 366", () => {
    const state: ShareFormState = {
      projectName: "Bounds",
      startDate: new Date(2026, 0, 5),
      mode: "count",
      holidays: [],
      holidayBehavior: "skip",
      reminderMinutes: 0,
      timezone: "UTC",
      tracks: [
        mkTrack("t1", "Min", "#0ea5e9", 1),
        mkTrack("t2", "Max", "#22c55e", 366),
      ],
    };
    const decoded = decodeShareState(encodeShareState(state));
    expect(decoded).not.toBeNull();
    expect(decoded!.tracks[0].numberOfMeetings).toBe(1);
    expect(decoded!.tracks[1].numberOfMeetings).toBe(366);
  });

  it("rejects a count-mode token with neither project-level c nor any per-track nm", () => {
    // Encode a v2 token by hand to bypass the form's submit validation.
    const rawJson = JSON.stringify({
      v: 2,
      pn: "Broken",
      sd: "2026-01-05",
      m: "count",
      h: [],
      r: 0,
      tz: "UTC",
      tr: [
        {
          id: "t1",
          n: "A",
          c: "#0ea5e9",
          d: [1],
          ts: [{ s: "09:00", e: "10:00" }],
          rec: { t: "weekly", i: 1 },
        },
      ],
    });
    // Use the same wire prefix as encodeToken().
    const token = "1" + LZString.compressToEncodedURIComponent(rawJson);
    expect(decodeShareState(token)).toBeNull();
  });

  it("v3 draft round-trips per-track counts", () => {
    const draft: DraftFormState = {
      mode: "count",
      tracks: [
        {
          id: "t1",
          name: "A",
          color: "#0ea5e9",
          selectedDays: [1],
          timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
          recurrence: { type: "weekly", interval: 1 },
          numberOfMeetings: 2,
        },
        {
          id: "t2",
          name: "B",
          color: "#22c55e",
          selectedDays: [3],
          timeSlots: [{ startTime: "11:00", endTime: "12:00" }],
          recurrence: { type: "weekly", interval: 1 },
          numberOfMeetings: 8,
        },
      ],
    };
    const decoded = decodeShareState(encodeDraftState(draft));
    expect(decoded).not.toBeNull();
    expect(decoded!.tracks[0].numberOfMeetings).toBe(2);
    expect(decoded!.tracks[1].numberOfMeetings).toBe(8);
  });
});
