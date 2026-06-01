import type { TimeSlot, Recurrence, HolidayBehavior } from "./scheduleGenerator";

export interface Track {
  id: string;
  name: string;
  color: string;
  selectedDays: number[];
  timeSlots: TimeSlot[];
  recurrence: Recurrence;
  location?: string;
  notes?: string;
  /** Optional per-group start date. When set, overrides ProjectState.startDate. */
  startDate?: Date;
  /** Optional predecessor track id, set when startDate was computed via "Start after group" helper. */
  startsAfter?: string;
}

export interface ProjectState {
  projectName: string;
  startDate: Date;
  mode: "count" | "endDate";
  numberOfMeetings?: number;
  endDate?: Date;
  holidays: Date[];
  holidayBehavior: HolidayBehavior;
  reminderMinutes: number;
  timezone: string;
  tracks: Track[];
}

export const TRACK_COLORS = [
  "#0ea5e9", // sky
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#64748b", // slate
];

let _idSeq = 0;
export function newTrackId(): string {
  _idSeq += 1;
  return `t_${Date.now().toString(36)}_${_idSeq}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createTrack(partial: Partial<Track> = {}, indexHint = 0): Track {
  return {
    id: partial.id ?? newTrackId(),
    name: partial.name ?? `Class ${indexHint + 1}`,
    color: partial.color ?? TRACK_COLORS[indexHint % TRACK_COLORS.length],
    selectedDays: partial.selectedDays ?? [],
    timeSlots: partial.timeSlots ?? [{ startTime: "", endTime: "" }],
    recurrence: partial.recurrence ?? { type: "weekly", interval: 1 },
    location: partial.location,
    notes: partial.notes,
    startDate: partial.startDate,
    startsAfter: partial.startsAfter,
  };
}

/**
 * Returns true if setting `activeId.startsAfter = sourceId` would create
 * a cycle in the dependency chain (including the self-reference case).
 */
export function wouldCreateCycle(
  activeId: string,
  sourceId: string,
  tracks: Array<{ id: string; startsAfter?: string }>
): boolean {
  if (activeId === sourceId) return true;
  const byId = new Map(tracks.map((t) => [t.id, t]));
  let cursor: string | undefined = sourceId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === activeId) return true;
    if (seen.has(cursor)) return true; // pre-existing cycle, treat as unsafe
    seen.add(cursor);
    cursor = byId.get(cursor)?.startsAfter;
  }
  return false;
}

/**
 * Detects any track that participates in a startsAfter cycle.
 * Returns the set of track ids involved in any cycle.
 */
export function findCycleTrackIds(
  tracks: Array<{ id: string; startsAfter?: string }>
): Set<string> {
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const bad = new Set<string>();
  for (const t of tracks) {
    const seen = new Set<string>();
    let cursor: string | undefined = t.id;
    while (cursor) {
      if (seen.has(cursor)) {
        // cursor onward is the cycle
        let c: string | undefined = cursor;
        const start = c;
        do {
          bad.add(c!);
          c = byId.get(c!)?.startsAfter;
        } while (c && c !== start);
        break;
      }
      seen.add(cursor);
      cursor = byId.get(cursor)?.startsAfter;
    }
  }
  return bad;
}
