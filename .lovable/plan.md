## Per-session location & notes overrides

Let users override the global location and notes on individual sessions (e.g. "Room B this week only"). Defaults stay the global values; overrides are visible, editable, and clearable, and flow through every export.

### Data model

Extend `Session` (in `src/pages/Index.tsx`, `src/components/ScheduleDisplay.tsx`, and propagate to `copyFormats.ts` / `googleCalendar.ts` / `scheduleGenerator.ts`) with two optional fields:

```ts
location?: string;        // override; undefined = use global
notes?: string;           // override; undefined = use global
```

`undefined` means "inherit global". Empty string `""` means "explicitly blank for this session" (so a user can suppress the global value on one session).

A helper resolves the effective values:
```ts
const effLocation = session.location ?? globalLocation;
const effNotes    = session.notes    ?? globalNotes;
```

### UI changes (`ScheduleDisplay.tsx` → `EditSessionPopover`)

Extend the existing per-session edit popover (already opened via the pencil icon) with two new fields below date/time:

- **Location** input — placeholder shows the global location (e.g. `Using default: Studio A`). Empty input + Save = inherit; user can click a small "Clear override" link to reset to inherit when an override exists.
- **Notes** textarea — same pattern, placeholder previews the global notes (truncated).

Save calls `onUpdateSession(index, { date, startTime, endTime, location, notes })` where `location`/`notes` are `string | undefined` (undefined when the user left it as "inherit").

On each session card, when an override is active, show a small badge next to the existing "edited" badge:
- `📍 override` when location differs
- `📝 override` when notes differ

(Reuse existing badge styling.)

### Handler change (`Index.tsx`)

`handleUpdateSession` widens its `updated` param to include optional `location` and `notes`, and merges them into the session. The global `location`/`notes` state is untouched.

### Exports — pick up overrides

All four export paths must use the per-session effective values:

1. **`scheduleGenerator.ts` → `exportToCSV`**: per-row, use `session.location ?? opts.location` for the Location column and append `session.notes ?? opts.notes` to the description.
2. **`scheduleGenerator.ts` → `exportToICS`**: build `LOCATION` and the notes part of `DESCRIPTION` per VEVENT instead of once up front.
3. **`copyFormats.ts`** (plain, markdown, HTML): currently take a single `location`/`notes` for the whole schedule. Change the three formatters to read from `session.location` / `session.notes` first, falling back to the passed-in globals. Markdown/HTML get an extra column or inline annotation only when at least one session has an override (to keep the common case clean):
   - Plain: when a session has a location override, swap the `@ ${location}` suffix; append per-session notes on a new indented line under that session.
   - Markdown table: add a `Location` column only if any session overrides it; trailing per-session notes become a `> note` quote block under the table grouped by session number when overrides exist.
   - HTML mirrors the markdown logic.
4. **`googleCalendar.ts` → `buildGoogleCalendarUrl`**: today it builds a single template event with `RDATE`. Per-session location/notes can't be expressed in a single Google template URL. Behavior: when any session has an override, fall back to the existing single-event template using globals **and** return a new flag `hasOverrides: true` so `ScheduleDisplay` can show a toast (`toast.warning(t('toast.gcalOverridesDropped'))`) before opening the URL. Existing `hasTimeConflicts` behavior is unchanged.

### Share link / recent schedules

`ShareFormState` and `recentSchedules` only persist form inputs, not generated sessions, so they don't need schema changes. Per-session overrides live only on the generated sessions in memory and are lost on regenerate (acceptable — regenerating is a destructive action already, like time edits today).

### i18n keys (`src/locales/en.json` & `id.json`)

Add under `schedule`:
- `locationOverrideLabel`, `notesOverrideLabel`
- `useDefaultPlaceholder` (e.g. `Using default: {{value}}`)
- `clearOverride`
- `locationOverrideBadge`, `notesOverrideBadge`

Add under `toast`:
- `gcalOverridesDropped` (e.g. `Per-session location/notes were dropped — Google Calendar only supports one set per event.`)

### Files touched

- `src/components/ScheduleDisplay.tsx` — extend popover, add badges, widen `Session` interface, pass overrides through `onUpdateSession`, surface gcal warning.
- `src/pages/Index.tsx` — widen `Session` type and `handleUpdateSession` signature.
- `src/utils/scheduleGenerator.ts` — per-row location/notes in CSV & ICS; widen `Session` type used in exports.
- `src/utils/copyFormats.ts` — per-session overrides in plain/markdown/HTML.
- `src/utils/googleCalendar.ts` — add `hasOverrides` flag, keep single-template behavior.
- `src/locales/en.json`, `src/locales/id.json` — new strings.

### Out of scope

- No new dependencies.
- No changes to generation logic, recurrence, share links, or theme.
- No bulk-edit ("apply override to every Friday") — single-session only for this pass.
