## Goal
Add a single, strict validation layer for date, timezone, and meeting frequency inputs, applied both at form submit and at the export boundary (ICS/CSV), so bad/malicious values can never reach the generator or exported files.

## What gets validated

**Dates (start date, end date, holiday dates, per-track start date)**
- Must be valid `Date` instances (`!isNaN(getTime())`)
- Must be finite and within a sane window: year between 1970 and 2100
- `endDate >= startDate` (already partial — formalize)
- Per-track `startDate >= project startDate` (already partial)
- Holidays: dedupe + drop anything outside [startDate, endDate or +10y]

**Timezone**
- Must be a non-empty string ≤ 64 chars
- Must pass `sanitizeTzid` (already exists) — reject (not silently coerce) at the form layer with a field error; keep silent coercion to `UTC` only as a last-resort safety net inside `exportToICS`/`exportToCSV`/`perTrackExport`
- Reject control chars and anything not in IANA list when `Intl.supportedValuesOf` is available

**Meeting frequency / counts**
- `numberOfMeetings`: integer, 1–366 (matches current `max="366"` and `MAX_SESSIONS` intent); reject non-integer, NaN, Infinity, negative, > 366
- `weeklyInterval`: integer 1–12
- `ordinals` (monthlyByWeekday): subset of `{1,2,3,4,-1}`, 1–5 entries, deduped
- `daysOfMonth` (monthlyByDate): integers in `{1..31, -1}`, 1–31 entries, deduped
- `selectedDays`: subset of `{0..6}`, required (≥1) when recurrence needs weekdays
- `timeSlots`: `HH:MM` 24h regex, `start < end`, 1–6 slots
- `reminderMinutes`: must be one of `REMINDER_OPTIONS`

## Implementation

1. **New module `src/utils/validation.ts`**
   - Zod schemas: `timezoneSchema`, `dateSchema` (with min/max year), `numberOfMeetingsSchema`, `weeklyIntervalSchema`, `ordinalsSchema`, `daysOfMonthSchema`, `selectedDaysSchema`, `timeSlotSchema`, `reminderSchema`
   - Composed `projectStateSchema` returning typed `ProjectState`
   - Helper `validateExportOptions(opts)` for `ExportOptions` (timezone, reminderMinutes, lengths of location/notes/filename)
   - Pure functions, no i18n inside — return error codes that the form maps to translated strings

2. **`src/components/ScheduleForm.tsx`**
   - Replace ad-hoc checks in the submit handler with `projectStateSchema.safeParse(...)`
   - Map Zod issues to the existing `FormErrors` shape (project-level + per-track) using a small `errorCode → t(...)` table
   - Keep existing UX (focus first invalid, toast for track errors)
   - Add the missing per-field guards already used in UI (interval, ordinals, daysOfMonth) so they actually block submission

3. **Export hardening (`src/utils/scheduleGenerator.ts`, `src/utils/perTrackExport.ts`)**
   - At the top of `exportToICS`, `exportToCSV`, and `exportPerTrackZip`, run `validateExportOptions` and throw a typed `ExportValidationError` on failure
   - Keep `sanitizeTzid` as the final safety net (defense in depth)
   - Clamp/validate `reminderMinutes` to the allowed set before writing `TRIGGER:`
   - Validate every `session.date` is a real Date before formatting (prevents `Invalid Date` strings in ICS/CSV)

4. **Caller (`src/pages/Index.tsx`)**
   - Wrap export calls in try/catch, surface `toast.error` with a translated "Invalid export options" message

5. **i18n**
   - Add new keys under `form.validation.*` (e.g. `dateOutOfRange`, `timezoneInvalid`, `intervalInvalid`, `ordinalsInvalid`, `daysOfMonthInvalid`, `reminderInvalid`) to `src/locales/en.json` and `src/locales/id.json`

6. **Tests (`src/utils/__tests__/validation.test.ts`)**
   - Valid project passes
   - Each invalid case (bad TZ, NaN date, year 1800, year 2200, count 0/367/1.5/"abc", interval 0/13, bad ordinals, bad daysOfMonth, bad time slot, reminder 7) produces the expected error code
   - `validateExportOptions` rejects injected control chars in timezone and out-of-set reminder

## Files

- new: `src/utils/validation.ts`
- new: `src/utils/__tests__/validation.test.ts`
- edit: `src/components/ScheduleForm.tsx`
- edit: `src/utils/scheduleGenerator.ts`
- edit: `src/utils/perTrackExport.ts`
- edit: `src/pages/Index.tsx`
- edit: `src/locales/en.json`, `src/locales/id.json`

## Out of scope
- No changes to the generator algorithm itself
- No UI redesign — only error messages and blocking behavior change
