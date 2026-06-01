# Clarify the naming hierarchy

## Why

Right now the form shows three name-like surfaces stacked together — **Project name**, the **track tab label**, and an **"Activity name"** input — which reads as three competing identifiers. Under the hood there are only two stored values (`projectName` + per-track `name`); the tab label and the "Activity name" input edit the same field, which is the main source of confusion.

We'll keep the two-field model but rename everything to a clearer hierarchy and visually tie the name input to the active tab so the duplication stops feeling redundant.

## New vocabulary

| Old label | New label | What it means |
|---|---|---|
| Project name | **Program name** | Top-level container (used for filenames, PDF title, CSV "Class" column header) |
| Tracks / Track | **Groups / Group** | Parallel sub-schedules (e.g. Beginner, Advanced) |
| Activity name (per track) | **Session label** | What each generated session is called (used in CSV summary, ICS SUMMARY, PDF rows) |

Indonesian equivalents: Program / Grup / Sesi.

## UI changes

1. **Reorder + relabel the Essentials block** so the hierarchy reads top-down:
   - `Program name` (was Project name)
   - Mode picker (unchanged)
   - `Groups` tab bar (was Tracks) — tab still shows the group's name
   - Active group panel, headed by `Session label for "<group name>"` — the input that was "Activity name". Helper text: "Used as the title for each generated session. Renames the active tab."
2. **Visually couple the name input to the tab**: add a thin colored left border on the input matching the active group's color, and a small caption above it like `Editing: <Group A>` so the user immediately sees the input belongs to the tab above.
3. **Add-group button copy**: "Add another group" instead of "Add track".
4. **Empty/single-group state**: when only one group exists, the tab bar still shows but with a softer style (already in place); no further change here.

## Files to touch

- `src/locales/en.json`, `src/locales/id.json` — rename keys' user-facing strings only (keep JSON keys like `projectName`, `eventName`, `tracks.*` to avoid a code-wide rename). Update: `form.projectName`, `form.projectNamePlaceholder`, `form.eventName`, `form.eventNamePlaceholder`, `form.validation.projectNameRequired`, `form.validation.eventNameRequired`, `tracks.title`, `tracks.hint`, `tracks.add`, plus any "track"/"activity"/"project" copy in `ScheduleDisplay.tsx`, share/export confirmations, and PDF/CSV column headers that the user sees.
- `src/components/ScheduleForm.tsx` — relabel the two fields, add the "Editing: <group>" caption + colored accent on the Session label input, reorder so the tab bar sits directly above the active group panel (already close — minor spacing tweak).
- `src/components/TrackTabs.tsx` — update visible "Add" button copy via i18n key; no structural change.
- No changes to data shape, validation logic, exports, generator, tests, or storage keys. Internal variable names (`projectName`, `trackName`, `activityName`) stay as-is to keep the diff focused on UX.

## Out of scope

- Inline-editing the tab title (deferred — chosen option keeps the separate input).
- Renaming TypeScript identifiers, file names, or storage keys.
- Changing export file naming logic.
