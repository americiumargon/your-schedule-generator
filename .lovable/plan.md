## Fix missing translation keys

The form shows raw keys (`tracks.title`, `tracks.hint`, `tracks.add`, etc.) because the multi-track refactor added `t(...)` calls without adding the strings to the locale files.

### Steps

1. Inspect `src/components/ScheduleForm.tsx`, `src/components/TrackTabs.tsx`, `src/components/ScheduleDisplay.tsx`, and `src/pages/Index.tsx` to enumerate every new `t("...")` key introduced by the multi-track work (tracks.*, projectName, export scope, class column, toast.sessionUpdated, etc.).
2. Add the missing keys to `src/locales/en.json` with clear English copy.
3. Add the same keys to `src/locales/id.json` with Indonesian translations.
4. Verify in the preview that "tracks.title / tracks.hint / tracks.add" and the rename/duplicate/delete/color menu render real labels in both languages.

### Scope

Locale JSON files only — no logic or component changes.