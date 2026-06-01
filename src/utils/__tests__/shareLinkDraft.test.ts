import { describe, expect, it } from "vitest";
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
});
