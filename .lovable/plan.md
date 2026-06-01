## Goal

Let each group (track) optionally override the project start date, with a one-click helper that sets it to the day after another group's last session. Sequential and parallel scheduling both fall out of this.

## Model change

`src/utils/tracks.ts` — add an optional field:

```ts
export interface Track {
  // ...existing fields
  startDate?: Date; // overrides ProjectState.startDate when set
}
```

`src/utils/projectGenerator.ts` — use the override:

```ts
startDate: track.startDate ?? project.startDate,
```

End-of-schedule semantics stay shared (project-level `mode`, `numberOfMeetings`, `endDate`, `holidays`). When `endDate` mode is active and a group's start is later than the project end, that group produces zero sessions — surface a non-blocking warning toast.

## UI changes (`src/components/ScheduleForm.tsx`)

In the Essentials block, below the existing project-level **Start date** field, add a small per-group **"Group start date"** subsection. It belongs to the currently active tab and is purely additive — the project-level Start date stays as the default.

Layout (compact, single row on desktop):

```
Group start date:  [ uses project start ▾ ]  [ 📅 Jan 8, 2026 ]  [ Reset ]
                   "Start after: ( Group… ▾ )"
```

Behavior:
- Default state: no override → label reads "Uses project start (Jan 5, 2026)", date picker shows the project date but is grayed.
- Picking a date in the calendar sets `draft.startDate`.
- **"Start after group …" dropdown** lists every other group. Selecting one runs `generateSchedule` for that group with current draft values, takes the last session's date, and sets the active group's `startDate = lastSession.date + 1 day`. If the source group can't be generated (incomplete fields, empty result), show a toast: "Pick days/times for {Group} first."
- **Reset** button clears the override (`startDate = undefined`).
- Display the resolved effective start as caption text when overridden: "Starts {date} — {N} days after project start" or "Starts after {Group X}".

Validation:
- If override start < project start, show inline error: "Group start can't be before project start."
- If `mode === "endDate"` and override start > project end, allow but show warning caption: "After project end date — this group won't have sessions."

## Generation & exports

No changes needed beyond `projectGenerator.ts`. Combined-view sorting (`a.date - b.date`) already places sequential groups in the right order. CSV/ICS/Google Calendar all read from each session's `date` — no format changes.

Google Calendar URL builder already requires a single representable weekly pattern *per call*; per-group URLs are unaffected. The combined "all groups" Google Calendar link (if present) will keep returning `not_representable` when groups start at different dates, which is correct.

## Persistence

- `src/utils/shareLink.ts` — `Track.startDate` rides along through `ProjectState` serialization; verify the existing date (de)serializer handles the optional field. If serialization is JSON-stringified, ensure dates are revived to `Date` objects on load (mirror how `project.startDate` is handled).
- `src/utils/recentSchedules.ts` — same check; reuse existing date revival.

## i18n

Add new keys in `src/locales/en.json` and `src/locales/id.json`:

```
tracks.groupStartDate
tracks.usesProjectStart
tracks.startAfter
tracks.startAfterPlaceholder
tracks.resetOverride
tracks.effectiveStartCaption
tracks.startBeforeProject       // validation
tracks.startAfterProjectEnd     // warning
tracks.sourceGroupNotReady      // toast for "Start after" helper
```

## Tests

Extend `src/utils/__tests__/exportE2E.test.ts` (or new `projectGenerator.test.ts`):

1. Per-group override: two groups, group B has `startDate = projectStart + 14 days`; assert byTrack[A] starts at projectStart, byTrack[B] starts at the override.
2. "Start after" simulation: generate group A (5 sessions, Mon/Wed), then set group B's start to A.last + 1 day, regenerate; assert no date overlap and B's first date > A's last date.
3. Combined ordering: assert `combined` is sorted by date across groups.

## Out of scope

- Per-group end date / count overrides.
- A project-level "Sequential | Parallel" toggle (option 3 from earlier).
- Dependency chains beyond a single hop (e.g., "start after A and B both finish").
- Auto-recompute when a referenced group changes — the helper writes a fixed date, not a live link. (Re-click to refresh.)
