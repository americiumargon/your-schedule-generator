## Wire tracks through Display, Recent, Export, and rename to "Tracks"

### 1. Rename "Classes" → "Tracks" in i18n
Change English `tracks.title` → "Tracks", `tracks.hint` → "Plan multiple tracks in one project", `tracks.add` → "Add track", `tracks.newName` → "Track", `tracks.minOne` → "At least one track is required". Indonesian: "Trek" (or keep "Track"). Also update CSV/ICS description label `Class: …` → `Track: …` in `scheduleGenerator.ts`, and add `schedule.colTrack` / `pdf.col.track` keys.

### 2. ScheduleDisplay: render track info + scope picker
- Widen `Session` interface to include optional `trackId`, `trackName`, `trackColor`.
- When >1 unique `trackId` is present:
  - Show a colored dot + track name on each session row.
  - Show a new "Track" column header label on screen and print views.
  - Render an export-scope dropdown (Combined / Per track ZIP) next to the CSV/ICS/PDF buttons.
- `onExport` signature gains `scope: "combined" | "perTrack"`; passed through to `Index.handleExport`.

### 3. Index: pass tracks + byTrack and dispatch per-track ZIP
- Store `byTrack` and `tracks` from `generateProject` result alongside `sessions`.
- `handleExport(format, enabled, lang, scope)`:
  - `combined` → existing path with `includeTrackColumn` when multi-track.
  - `perTrack` → call `exportPerTrackZip(byTrack, tracks, projectName, format, opts, branding, t, lang)` from `src/utils/perTrackExport.ts`.

### 4. RecentSchedules: show track count
Display a small `· N tracks` suffix next to the createdAt line when `formState.tracks.length > 1`. Add `recent.trackCount` i18n key with plural form.

### 5. i18n additions (en + id)
`schedule.colTrack`, `schedule.exportScope`, `schedule.exportScopeCombined`, `schedule.exportScopePerTrack`, `pdf.col.track`, `recent.trackCount` (`{{count}} track` / plural).

### Out of scope
- Per-tab error indicator on TrackTabs (separate polish pass).
- Per-track timezone/holidays/reminders.

### Files touched
- `src/locales/en.json`, `src/locales/id.json`
- `src/components/ScheduleDisplay.tsx`
- `src/pages/Index.tsx`
- `src/components/RecentSchedules.tsx`
- `src/utils/scheduleGenerator.ts` (rename `Class:` → `Track:` label)