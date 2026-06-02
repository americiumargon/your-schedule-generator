import { describe, it, expect } from "vitest";
import { generateProject } from "@/utils/projectGenerator";
import { createTrack, wouldCreateCycle, findCycleTrackIds } from "@/utils/tracks";
import type { ProjectState } from "@/utils/tracks";

function baseProject(overrides: Partial<ProjectState> = {}): ProjectState {
  return {
    projectName: "Spring Term",
    startDate: new Date(2026, 0, 5), // Mon
    mode: "count",
    numberOfMeetings: 4,
    holidays: [],
    holidayBehavior: "skip",
    reminderMinutes: 0,
    timezone: "UTC",
    tracks: [],
    ...overrides,
  };
}

describe("generateProject — per-group startDate override", () => {
  it("uses project.startDate when track.startDate is undefined", () => {
    const project = baseProject({
      tracks: [
        createTrack({
          name: "A",
          selectedDays: [1],
          timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
          recurrence: { type: "weekly", interval: 1 },
        }),
      ],
    });
    const { byTrack } = generateProject(project);
    const a = Object.values(byTrack)[0];
    expect(a[0].date.toISOString().slice(0, 10)).toBe("2026-01-05");
    expect(a).toHaveLength(4);
  });

  it("honors per-track startDate and parallels other tracks correctly", () => {
    const groupB = createTrack({
      name: "B",
      selectedDays: [1],
      timeSlots: [{ startTime: "11:00", endTime: "12:00" }],
      recurrence: { type: "weekly", interval: 1 },
      startDate: new Date(2026, 0, 19), // two weeks later
    });
    const groupA = createTrack({
      name: "A",
      selectedDays: [1],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "weekly", interval: 1 },
    });
    const { byTrack, combined } = generateProject(baseProject({ tracks: [groupA, groupB] }));

    expect(byTrack[groupA.id][0].date.toISOString().slice(0, 10)).toBe("2026-01-05");
    expect(byTrack[groupB.id][0].date.toISOString().slice(0, 10)).toBe("2026-01-19");

    // Combined sorted chronologically across both groups.
    const dates = combined.map((s) => s.date.getTime());
    const sorted = [...dates].sort((a, b) => a - b);
    expect(dates).toEqual(sorted);
  });

  it("sequential groups via 'start after' (override = previous group's last + 1 day) don't overlap", () => {
    const groupA = createTrack({
      name: "A",
      selectedDays: [1, 3], // Mon, Wed
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "weekly", interval: 1 },
    });
    const { byTrack: aOnly } = generateProject(
      baseProject({ tracks: [groupA], numberOfMeetings: 5 })
    );
    const aSessions = aOnly[groupA.id];
    const lastA = aSessions[aSessions.length - 1].date;
    const dayAfterLastA = new Date(lastA);
    dayAfterLastA.setDate(dayAfterLastA.getDate() + 1);

    const groupB = createTrack({
      name: "B",
      selectedDays: [1, 3],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "weekly", interval: 1 },
      startDate: dayAfterLastA,
    });

    const { byTrack } = generateProject(
      baseProject({ tracks: [groupA, groupB], numberOfMeetings: 5 })
    );
    const firstB = byTrack[groupB.id][0].date;
    expect(firstB.getTime()).toBeGreaterThan(lastA.getTime());
  });

  it("honors per-track numberOfMeetings overrides independently", () => {
    const groupA = createTrack({
      name: "A",
      selectedDays: [1],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "weekly", interval: 1 },
      numberOfMeetings: 3,
    });
    const groupB = createTrack({
      name: "B",
      selectedDays: [1],
      timeSlots: [{ startTime: "11:00", endTime: "12:00" }],
      recurrence: { type: "weekly", interval: 1 },
      numberOfMeetings: 6,
    });
    const { byTrack } = generateProject(
      baseProject({ tracks: [groupA, groupB], numberOfMeetings: undefined })
    );
    expect(byTrack[groupA.id]).toHaveLength(3);
    expect(byTrack[groupB.id]).toHaveLength(6);
  });

  it("falls back to project.numberOfMeetings when a track has none", () => {
    const groupA = createTrack({
      name: "A",
      selectedDays: [1],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "weekly", interval: 1 },
    });
    const { byTrack } = generateProject(
      baseProject({ tracks: [groupA], numberOfMeetings: 5 })
    );
    expect(byTrack[groupA.id]).toHaveLength(5);
  });
});

describe("wouldCreateCycle / findCycleTrackIds", () => {
  it("rejects self-reference", () => {
    const tracks = [{ id: "a" }, { id: "b" }];
    expect(wouldCreateCycle("a", "a", tracks)).toBe(true);
  });

  it("detects direct A -> B -> A cycle", () => {
    const tracks = [{ id: "a", startsAfter: "b" }, { id: "b" }];
    // setting b.startsAfter = a would close the cycle
    expect(wouldCreateCycle("b", "a", tracks)).toBe(true);
  });

  it("detects indirect A -> B -> C -> A cycle", () => {
    const tracks = [
      { id: "a", startsAfter: "b" },
      { id: "b", startsAfter: "c" },
      { id: "c" },
    ];
    expect(wouldCreateCycle("c", "a", tracks)).toBe(true);
  });

  it("allows safe chains", () => {
    const tracks = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(wouldCreateCycle("b", "a", tracks)).toBe(false);
    expect(wouldCreateCycle("c", "b", tracks)).toBe(false);
  });

  it("findCycleTrackIds flags all members of a cycle", () => {
    const tracks = [
      { id: "a", startsAfter: "b" },
      { id: "b", startsAfter: "a" },
      { id: "c" },
    ];
    const bad = findCycleTrackIds(tracks);
    expect(bad.has("a")).toBe(true);
    expect(bad.has("b")).toBe(true);
    expect(bad.has("c")).toBe(false);
  });
});
