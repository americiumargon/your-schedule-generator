Make "Clear All" reversible with an Undo affordance.

Approach: use sonner's toast action button (already used throughout the app) to surface Undo right after clearing — no extra UI clutter.

Changes in `src/pages/Index.tsx`:
- In `handleClear`, capture the current `sessions` and `eventName` before clearing.
- Replace `toast.success(t('toast.cleared'))` with `toast.success(t('toast.cleared'), { action: { label: t('toast.undo'), onClick: () => { setSessions(prev); setEventName(prevName); } }, duration: 6000 })`.
- Guard against clicking Undo when there's nothing to restore.

Changes in `src/locales/en.json` and `src/locales/id.json`:
- Add `toast.undo`: "Undo" / "Batalkan".
- Optionally update `toast.cleared` wording to hint at undo, or leave as-is.

No changes to ScheduleDisplay needed.