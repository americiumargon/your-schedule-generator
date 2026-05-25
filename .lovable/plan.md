Add two high-impact, low-effort features to the schedule generator:

1. Copy schedule to clipboard
   - Add a "Copy" button next to CSV/ICS in ScheduleDisplay
   - Format the enabled sessions as clean text (one per line) with event name, session number, date, and time range
   - Use the navigator.clipboard API with a toast on success/failure
   - Add i18n keys: `schedule.copyButton`, `toast.copied`, `toast.copyFailed`

2. Session summary stats
   - Show a compact summary card above the session list in ScheduleDisplay
   - Display: total sessions, date span (first to last date), and number of weeks
   - Add i18n keys: `summary.totalSessions`, `summary.dateSpan`, `summary.weeks`

Technical details
- `src/components/ScheduleDisplay.tsx`: add `handleCopy` function, import `Copy` icon from lucide-react, add summary section with `Card` or inline text
- `src/locales/en.json` and `src/locales/id.json`: add the new keys under `schedule` and a new `summary` block