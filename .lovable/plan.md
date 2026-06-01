## Goal
Simplify the form for casual users (single schedule, no jargon) while keeping every existing feature one click away under **More options**.

## Guiding principle
*One group = one schedule.* The words "group" and "session label" should not appear in the UI until the user opts into multi-group mode by clicking **Add another group**.

## Decisions
- Keep the term **"Groups"** (no rename) — minimal churn, i18n stays intact.
- **Auto-mirror** the session label to the schedule name when only one group exists.
- Skip the "one-click preset chips" empty state for this pass.
- Timezone, location, reminder, branding stay in **More options** (already there).

## Changes

### 1. `ScheduleForm.tsx` — Essentials, single-group mode
When `drafts.length === 1`:
- **Hide the `TrackTabs`** block entirely (lines ~468-483).
- **Hide the "Session label" (eventName) input** (lines ~485-513). The active group's `name` is kept in sync with `projectName` automatically via a `useEffect`: `if (drafts.length === 1) updateActive({ name: projectName })`.
- **Hide the entire "Per-group start date override" block** (lines ~543-621).
- **Rename label** `form.projectName` from "Program name" → **"Schedule name"** (EN) / **"Nama jadwal"** (ID). Update placeholder accordingly.

When `drafts.length >= 2`:
- All hidden blocks reappear, and the "Session label" field is editable inside each group's tab (current behavior).
- Add a small **"Add another group"** button visible in single-group mode too, so the upgrade path is discoverable. Place it as a subtle text button under the form near the bottom of Essentials: `+ Add another group`.

### 2. Reorder Essentials
New order:
```
1. Schedule name
2. Start date
3. End the schedule  [After N sessions | On specific date]
4. Days of the week
5. Session time
( + Add another group  — text button, single-group mode only )
```
The "End the schedule" mode block moves up to sit directly under Start date (currently it sits after the per-group override block).

### 3. Smarter defaults (only when `initialState` is absent)
- `startDate` defaults to **next Monday** at form mount (using `date-fns` `nextMonday(new Date())`).
- First time slot defaults to **`09:00`–`10:00`**.
- `numberOfMeetings` default input value = **`"8"`**.
- These defaults only apply on fresh mount, never when loading from share link / recent.

### 4. `ScheduleDisplay.tsx` — single-group polish
When the generated project has only one group:
- Hide the **"Export as: Combined / One file per group"** scope toggle.
- Hide the **"Group" column** in the schedule table (verify current behavior; conditionally render).

### 5. i18n
Update existing keys, no new keys required:
- EN `form.projectName`: "Program name" → "Schedule name"
- EN `form.projectNamePlaceholder`: → "e.g. Yoga class, Team standup, Spring semester"
- ID `form.projectName`: "Nama program" → "Nama jadwal"
- ID `form.projectNamePlaceholder`: → "contoh: Kelas yoga, Rapat tim, Semester genap"
- EN `tracks.add`: keep "Add another group" (already exists, just surfaced in a new spot).

### 6. Validation tweak
`form.validation.eventNameRequired` is currently checked per draft. When single-group + auto-mirrored, the eventName comes from projectName, so projectName-required is sufficient. Keep the per-draft check (still relevant for multi-group), but make sure the toast doesn't fire if the only failure is the auto-mirrored name being empty (the projectName error already covers it).

## What stays exactly the same
- Generation logic, exports (CSV/ICS/PDF/Google), share links, recent schedules, branding, recurrence types, holidays, per-group startsAfter/cycle detection — untouched.
- Multi-group experience is unchanged once unlocked.

## Files touched
- `src/components/ScheduleForm.tsx` (bulk of work: conditional rendering, reorder, auto-mirror effect, defaults, "Add another group" CTA)
- `src/components/ScheduleDisplay.tsx` (conditional hide of scope toggle + Group column)
- `src/locales/en.json`, `src/locales/id.json` (label rewording)

## Out of scope
- Visual redesign / color / typography changes.
- New empty-state preset chips.
- Renaming "Groups" to "Classes."
- Removing any feature.
- Changes to exports, scheduling math, or share-link format.