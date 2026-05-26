## Custom location & notes

Add optional **Location** and **Notes** fields to the form and pipe them through to CSV (Location, Description columns) and ICS (LOCATION, DESCRIPTION).

### UX
- Two new optional inputs at the bottom of `ScheduleForm`, above the Generate button:
  - **Location** — single-line `Input` (e.g., "Zoom link", "Conference Room B").
  - **Notes** — multi-line `Textarea` (3 rows). Used as the event description; appended to the existing per-session description text.
- Both are optional. Empty values keep the current behavior.

### Data flow
- `ScheduleForm` adds `location` and `notes` state, validates max length (e.g. 200 / 2000 chars), sanitizes line breaks for CSV, and passes them in `onGenerate`.
- `Index.tsx` stores `location` and `notes` alongside `eventName`, and forwards them into `handleExport` → `exportToCSV` / `exportToICS`.
- Also include them in the copy-to-clipboard output in `ScheduleDisplay` (one line per session, location appended after time; notes added as a trailing block if non-empty).

### Export changes (`src/utils/scheduleGenerator.ts`)
- `exportToCSV(sessions, eventName, language, { location, notes })`:
  - Put `location` into the Location column.
  - Append `notes` to the existing Description (newline-separated, escaped for CSV).
- `exportToICS(sessions, eventName, language, { location, notes })`:
  - Emit `LOCATION:<escaped>` when set.
  - Append `notes` to `DESCRIPTION` (escape `,`, `;`, `\n` per RFC 5545).
- Add a small `escapeICS` helper.

### i18n (`en.json` / `id.json`)
- `form.location` / `form.locationPlaceholder`
- `form.notes` / `form.notesPlaceholder`
- Validation messages for max length.

### Out of scope
- Per-session overrides for location/notes (single global value for now).
- Reminders and timezone (separate upcoming tasks).
