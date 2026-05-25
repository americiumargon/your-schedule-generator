Add an **End-date mode** so users can choose between specifying a fixed number of sessions OR an end date.

## UX

In the form, add a toggle (Tabs or RadioGroup) above the current "Number of Sessions" field:
- **By count** (default, current behavior) — input number of sessions
- **By end date** — pick an end date; sessions are generated for every matching weekday up to and including that date, skipping holidays

Only the relevant input is shown for the selected mode. The rest of the form (activity name, start date, weekdays, times, holidays) stays unchanged.

## Changes

**`src/components/ScheduleForm.tsx`**
- Add state: `mode: "count" | "endDate"` (default `"count"`) and `endDate: Date | undefined`.
- Add a Tabs (or RadioGroup) control labeled "Generate by" with two options.
- Conditionally render either the "Number of Sessions" input or an end-date picker (Popover + Calendar, matching the existing start-date picker pattern with `pointer-events-auto`).
- Extend the zod schema with a discriminated union on `mode`:
  - `count` mode: requires `numberOfMeetings` (existing rules)
  - `endDate` mode: requires `endDate` and validates `endDate >= startDate`
- Pass either `numberOfMeetings` or `endDate` to `onGenerate` via the updated payload shape.

**`src/utils/scheduleGenerator.ts`**
- Update `generateSchedule` to accept either a count or an end date. Cleanest API: change the signature to take an options object, e.g.
  ```ts
  generateSchedule({
    startDate, selectedDays, startTime, endTime, holidays,
    mode: "count" | "endDate",
    numberOfMeetings?, endDate?
  })
  ```
- In `endDate` mode, iterate days from `startDate` through `endDate` inclusive, pushing a session for each day that matches `selectedDays` and isn't a holiday.
- Add a safety cap (e.g. max 1000 generated sessions) to prevent runaway loops if the user picks an absurd range.

**`src/pages/Index.tsx`**
- Update `handleGenerate` signature/payload to forward the new fields to `generateSchedule`.

**`src/locales/en.json` & `src/locales/id.json`**
- Add new keys under `form`:
  - `generateBy` ("Generate by" / "Buat berdasarkan")
  - `modeByCount` ("Number of sessions" / "Jumlah sesi")
  - `modeByEndDate` ("End date" / "Tanggal selesai")
  - `endDate` ("End Date" / "Tanggal Selesai")
  - `pickEndDate` ("Pick an end date" / "Pilih tanggal selesai")
- Add validation messages:
  - `validation.endDateRequired` ("Please select an end date" / "Silakan pilih tanggal selesai")
  - `validation.endDateAfterStart` ("End date must be on or after the start date" / "Tanggal selesai harus sama dengan atau setelah tanggal mulai")
  - `validation.noSessionsInRange` ("No sessions fall within the selected range" / "Tidak ada sesi dalam rentang yang dipilih")

## Notes
- No backend / data model changes — purely frontend.
- The generator's safety cap also protects against degenerate cases (e.g. no weekdays selected).
- Existing CSV/ICS export and the Clear All button keep working unchanged because they consume the resulting `Session[]`.