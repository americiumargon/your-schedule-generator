## Reminders (VALARM in ICS)

Add an optional reminder selector to the form. When set, embed a `VALARM` block per event in the ICS export so the user's calendar app fires a notification before each session. CSV is unaffected (Google CSV import doesn't support reminders).

### UX
- New **Reminder** dropdown in `ScheduleForm`, placed right after the time inputs (above Holidays).
- Options (single-select):
  - None (default)
  - 5 minutes before
  - 15 minutes before
  - 30 minutes before
  - 1 hour before
  - 1 day before
- Value stored as minutes (`0` = none).

### Data flow
- `ScheduleForm` adds `reminderMinutes` state (number, default 0). Validate with Zod against an allowed enum `[0, 5, 15, 30, 60, 1440]`. Pass into `onGenerate`.
- `Index.tsx` stores `reminderMinutes`, resets on clear (with undo), and forwards it via `handleExport` → `exportToICS` options.

### ICS changes (`src/utils/scheduleGenerator.ts`)
- Extend `ExportOptions` with `reminderMinutes?: number`.
- When `reminderMinutes > 0`, insert a `VALARM` block inside each `VEVENT`:
  ```
  BEGIN:VALARM
  ACTION:DISPLAY
  DESCRIPTION:<event summary>
  TRIGGER:-PT<minutes>M    // or -P1D for 1440
  END:VALARM
  ```
  - Use `-PT{minutes}M` for sub-day; `-P1D` for 1440 to be friendlier.
- No change to CSV export.

### i18n (`en.json` / `id.json`)
- `form.reminder`, `form.reminderNone`
- `form.reminderMinutes` ("{{count}} minutes before" / pluralized)
- `form.reminderHours` ("{{count}} hour before", pluralized)
- `form.reminderDays` ("{{count}} day before")

### Out of scope
- Per-session reminder overrides.
- Multiple reminders per event.
- Email/audio alarm actions (DISPLAY only).
