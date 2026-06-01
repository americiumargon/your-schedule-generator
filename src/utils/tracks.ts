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
  };
}
