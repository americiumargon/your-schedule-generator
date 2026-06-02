import { generateSchedule } from "./scheduleGenerator";
import type { ProjectState, Track } from "./tracks";

export interface TrackedSession {
  date: Date;
  sessionNumber: number; // global numbering in combined; per-track in byTrack
  trackSessionNumber: number; // numbering inside the originating track
  startTime: string;
  endTime: string;
  slotLabel?: string;
  rolledFrom?: Date;
  location?: string;
  notes?: string;
  trackId: string;
  trackName: string;
  trackColor: string;
}

export interface GeneratedProject {
  byTrack: Record<string, TrackedSession[]>;
  combined: TrackedSession[];
}

function tagSessions(track: Track, sessions: ReturnType<typeof generateSchedule>): TrackedSession[] {
  return sessions.map((s) => ({
    ...s,
    trackSessionNumber: s.sessionNumber,
    trackId: track.id,
    trackName: track.name,
    trackColor: track.color,
  }));
}

export function generateProject(project: ProjectState): GeneratedProject {
  const byTrack: Record<string, TrackedSession[]> = {};
  const all: TrackedSession[] = [];

  for (const track of project.tracks) {
    const raw = generateSchedule({
      startDate: track.startDate ?? project.startDate,
      selectedDays: track.selectedDays,
      timeSlots: track.timeSlots,
      holidays: project.holidays,
      holidayBehavior: project.holidayBehavior,
      recurrence: track.recurrence,
      mode: project.mode,
      numberOfMeetings: track.numberOfMeetings ?? project.numberOfMeetings,
      endDate: project.endDate,
    });
    // Apply per-session location/notes defaults from track if present
    const tagged = tagSessions(track, raw).map((s) => ({
      ...s,
      location: s.location ?? track.location,
      notes: s.notes ?? track.notes,
    }));
    byTrack[track.id] = tagged;
    all.push(...tagged);
  }

  // Sort combined by date+startTime; reassign global session numbers
  all.sort((a, b) => {
    const da = a.date.getTime();
    const db = b.date.getTime();
    if (da !== db) return da - db;
    return a.startTime.localeCompare(b.startTime);
  });
  const combined = all.map((s, i) => ({ ...s, sessionNumber: i + 1 }));

  return { byTrack, combined };
}
