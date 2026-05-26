## Timezone selector

Today the ICS export converts every event to UTC (`...Z`), which silently shifts times for anyone not in UTC. Add a timezone picker so the ICS file represents events in the user's chosen IANA timezone.

### UX
- New **Timezone** field in `ScheduleForm`, placed right after the time inputs (above Reminder).
- Searchable Combobox (shadcn `Command` inside a `Popover`) populated from `Intl.supportedValuesOf('timeZone')`, with a fallback to a curated list (~30 common zones) if the runtime doesn't support it.
- Default value = `Intl.DateTimeFormat().resolvedOptions().timeZone` (the user's browser tz), shown on first render.
- A small helper line: "Used for ICS exports. CSV uses local time in your calendar."

### Data flow
- `ScheduleForm` adds `timezone` state (string IANA name), validates non-empty via Zod, passes through `onGenerate`.
- `Index.tsx` stores `timezone`, resets on clear (with undo), forwards via `handleExport` → `exportToICS`.

### ICS changes (`src/utils/scheduleGenerator.ts`)
- Extend `ExportOptions` with `timezone?: string`.
- When `timezone` is set and not `"UTC"`:
  - Emit `DTSTART;TZID=<iana>:YYYYMMDDTHHMMSS` and `DTEND;TZID=<iana>:YYYYMMDDTHHMMSS` (no `Z` suffix).
  - The local datetime string is built directly from the session date + the chosen `startTime`/`endTime` — no UTC conversion happens. This matches what the user actually picked in the form.
  - Prepend a minimal `VTIMEZONE` block inside `VCALENDAR`:
    ```
    BEGIN:VTIMEZONE
    TZID:<iana>
    END:VTIMEZONE
    ```
    Most modern clients (Google, Apple, Outlook 365) resolve the IANA name directly without needing full DST rules. This keeps the file small and avoids bundling tzdata.
- When `timezone === "UTC"` (or unset for back-compat): keep current behavior (`...Z`). The default will be the user's tz, but exporting in UTC stays available.

### CSV
- Unchanged. Google Calendar's CSV import interprets times in the target calendar's timezone, so we leave times as-is.

### i18n (`en.json` / `id.json`)
- `form.timezone`, `form.timezoneDescription`, `form.timezonePlaceholder`, `form.timezoneSearchPlaceholder`, `form.timezoneEmpty`.

### Out of scope
- Per-session timezone overrides.
- Full DST-aware VTIMEZONE rules (relying on client IANA resolution).
- Recomputing already-generated sessions when the tz changes — tz only affects export, not the generated date/time values.
