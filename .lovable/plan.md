## Problem

Currently, "Number of sessions" is a single project-level field. Changing it regenerates all groups using the same count, so users cannot give each group its own length.

## Solution

In **count mode**, move the count to each track. End-date mode stays project-wide (groups share the same window).

### Data model (`src/utils/tracks.ts`)

Add to `Track`:
```ts
numberOfMeetings?: number; // per-track session count (count mode)
```

### Schedule generator (`src/utils/projectGenerator.ts`)

When `project.mode === "count"`, pass `track.numberOfMeetings ?? project.numberOfMeetings` to `generateSchedule`. (Project-level value kept as a transient fallback for backward compat with existing share links / recent schedules; new UI always sets per-track.)

### Form UI (`src/components/ScheduleForm.tsx`)

- Remove the top-level "Number of sessions" input from count mode (keep the End Date input for endDate mode).
- Add a "Number of sessions" input to each active track panel (rendered just under the days/time-slots area), bound to `track.numberOfMeetings`.
- Validation: required in count mode, 1–366, mirrors existing `validateMeetings`. Errors shown per-track.
- Drop `numberOfMeetings` from the project-level error block; aggregate per-track errors into the existing per-track error map.
- On generate: build `ProjectState` with each track carrying its own count; omit project-level `numberOfMeetings`.

### Share links / recent schedules (`src/utils/shareLink.ts`)

- Encode/decode `track.numberOfMeetings` alongside other track fields.
- When loading an old link that has only the project-level `numberOfMeetings` in count mode, hydrate every track's `numberOfMeetings` from it so existing links keep working.

### i18n (`src/locales/en.json`, `src/locales/id.json`)

- Reuse existing `form.numberOfMeetings` label inside the track panel; no new strings strictly required, but add a short helper line like `tracks.sessionsHelp` ("Sessions for this group") for clarity in both locales.

### Tests

- Update `src/utils/__tests__/projectGenerator.test.ts`: add a case where two tracks have different `numberOfMeetings` and verify each track's session count.
- Update `src/utils/__tests__/shareLinkDraft.test.ts`: round-trip per-track count; legacy link fallback fills tracks.
- Update e2e `e2e/schedule.spec.ts`: the form interaction now sets the count inside the track panel instead of the top-level field.

## Out of scope

- End-date mode remains a single project-wide end date.
- No changes to PDF/CSV/ICS exports — they already render whatever sessions were generated.
