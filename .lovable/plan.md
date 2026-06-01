
# Multi-track scheduling

Let users plan multiple classes (e.g. "Beginner Mon/Wed", "Advanced Tue/Thu") inside one project and export them combined or per track.

## Concept

A **Project** has:
- Shared: project name, start date, end mode (count or end date), timezone, holidays, holiday behavior, reminder, branding.
- **Tracks[]**: each with its own name, color, weekdays, time slots, recurrence, location, notes.

A single track behaves exactly like today (backward compatible).

## UX

In `ScheduleForm`:
- Above the per-track fields, add a **Tracks** tab strip: `[Beginner] [Advanced] [+ Add track]`. Right-click / "..." menu on a tab: rename, duplicate, set color, delete (min 1 track).
- Fields that move **into the track tab**: activity name → track name, weekdays, time slots, recurrence, location, notes.
- Fields that stay **shared** above the tabs: start date, end mode/count/end date, holidays + behavior, reminder, timezone, branding.
- New top field: **Project name** (used as filename and combined header).
- Each track gets a color swatch (picked from a small preset palette). Color is shown in the tab, results list, and exports.

In `ScheduleDisplay`:
- View toggle: **Combined** (all tracks merged, sorted by date+time, with a colored "Track" pill) vs **By track** (collapsible group per track).
- Session count chip per track; existing edit/select/clear behavior preserved per session.
- Export bar gains a small **Scope** dropdown: `Combined` | `Per track (zip)` | individual track names.

## Data model

```ts
interface Track {
  id: string;           // uuid
  name: string;
  color: string;        // hex from preset palette
  selectedDays: number[];
  timeSlots: TimeSlot[];
  recurrence: Recurrence;
  location?: string;
  notes?: string;
}

interface ProjectState {
  projectName: string;
  startDate: Date;
  mode: "count" | "endDate";
  numberOfMeetings?: number;
  endDate?: Date;
  holidays: Date[];
  holidayBehavior: "skip" | "rollForward";
  reminderMinutes: number;
  timezone: string;
  tracks: Track[];
}

// Session gains:
interface Session {
  // ...existing
  trackId: string;
  trackName: string;
  trackColor: string;
}
```

Cap: total generated sessions across all tracks stays ≤ 366 (existing limit).

## Generation

`generateSchedule` already takes one track's worth of inputs. New wrapper `generateProject(project)`:
1. For each track, call `generateSchedule` with shared start/end/holidays + track-specific days/slots/recurrence/location/notes.
2. Tag each resulting session with `trackId`, `trackName`, `trackColor`.
3. Return `Record<trackId, Session[]>` plus a flat sorted `combined: Session[]`.
4. Renumber: combined uses a global `#`; per-track keeps the track-local `#`.

## Exports

- `exportToCSV/ICS/PDF` get an optional `scope: { mode: "combined" | "track"; trackId?: string }` and a `tracks` lookup.
- **Combined CSV/PDF**: new "Class" column with track name. PDF gets a small colored dot before the name.
- **Per-track**: today's behavior, filename `{project}-{track}.csv|ics|pdf`.
- **Per-track zip**: use `jszip` (new dep) to bundle all tracks for the selected format. Filename `{project}-{format}.zip`.

## Share & recent

Bump share token to `v: 2` with a `tracks` array; **decoder accepts both v1 and v2** (v1 → single-track project, track inherits today's shared fields). Recent schedules store the full `ProjectState`; old entries upgrade on load the same way.

## Files

### New
- `src/utils/tracks.ts` — `Track`, `ProjectState` types, `createTrack(defaults)`, `TRACK_COLORS` preset palette, id helper.
- `src/utils/projectGenerator.ts` — `generateProject(project) → { byTrack, combined }`.
- `src/components/TrackTabs.tsx` — tab strip with add/rename/duplicate/color/delete.
- `src/components/TrackEditor.tsx` — per-track fields extracted from `ScheduleForm` (name, days, slots, recurrence, location, notes).

### Edited
- `src/components/ScheduleForm.tsx` — split into shared section + `<TrackTabs/>` + `<TrackEditor track={active}/>`; emit `ProjectState` to `onGenerate`.
- `src/components/ScheduleDisplay.tsx` — view toggle (Combined/By track), track pill, export scope dropdown.
- `src/pages/Index.tsx` — hold `ProjectState` + generated `byTrack`/`combined`; route export calls with scope; pass `projectName` to PDF branding header.
- `src/utils/scheduleGenerator.ts` (`exportToCSV/ICS`) — accept optional track scope + add "Class" column for combined.
- `src/utils/pdfExport.ts` — Class column + colored dot when combined; per-track filename pattern.
- `src/utils/shareLink.ts` — v2 schema with `tracks`, decoder fallback for v1.
- `src/utils/recentSchedules.ts` — store/load `ProjectState`, upgrade v1 entries.
- `src/locales/en.json` + `id.json` — keys: `tracks.title`, `tracks.add`, `tracks.rename`, `tracks.duplicate`, `tracks.delete`, `tracks.color`, `tracks.minOne`, `tracks.untitled`, `schedule.viewCombined`, `schedule.viewByTrack`, `schedule.classColumn`, `export.scopeCombined`, `export.scopePerTrack`, `export.scopeTrack`, `form.projectName`.
- `package.json` — `bun add jszip`.

## Backward compatibility

- Existing v1 share links and recent entries load as a single-track project named after the old `eventName`.
- A fresh project starts with one track ("Class 1") so the form looks identical to today for single-class users.

## Out of scope

- Per-track timezone, per-track holidays, per-track reminders.
- Conflict detection (same room, overlapping times) — possible follow-up.
- Country holiday presets (still deferred).
