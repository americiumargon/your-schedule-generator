# CI tests for CSV and ICS export (Combined + Per-track ZIP)

Extend the existing Vitest suite with coverage for the two remaining export formats across both scopes.

## What gets added

### 1. Capture helper update — `src/test/setup.ts`
`exportToCSV` and `exportToICS` build a `Blob` and trigger download via an anchor + `URL.createObjectURL`. The existing `URL.createObjectURL` patch already pushes every blob into `globalThis.__capturedBlobs`, so no new wiring is needed. We only add a small typed helper export (optional) or rely on the existing global.

### 2. New test file — `src/utils/__tests__/csvIcsExport.test.ts`
Uses the same 2-track fixture as the PDF test (Beginner Mon/Wed 09:00–10:00, Advanced Tue/Thu 18:00–19:30, 4 sessions per track).

**Combined CSV** (`exportToCSV(..., { includeTrackColumn: true })`)
- 1 captured blob, mime `text/csv`.
- First line equals the Google Calendar header with trailing `Class` column.
- 8 data rows (1 header + 8).
- Rows contain `09:00 AM`, `06:00 PM`, both track names in the `Class` column.
- Formula-injection check: a session with notes starting `=cmd` is neutralized with a leading `'`.

**Combined ICS** (`exportToICS(...)`)
- 1 captured blob, mime `text/calendar`.
- Contains `BEGIN:VCALENDAR` / `END:VCALENDAR`, exactly 8 `BEGIN:VEVENT` blocks.
- Contains `[Beginner]` and `[Advanced]` summary tags.
- Contains `DTSTART` lines with `T090000` and `T180000`.

**Per-track ZIP — CSV** (`exportPerTrackZip(..., "csv", ...)`)
- Last captured blob is a zip; load with `JSZip.loadAsync`.
- Entries match `Beginner.*\.csv` and `Advanced.*\.csv`.
- Beginner.csv contains `09:00 AM`, not `18:00`/`06:00 PM`; Advanced.csv inverse.
- Neither file contains a `Class` column header (per-track files are single-track).

**Per-track ZIP — ICS** (`exportPerTrackZip(..., "ics", ...)`)
- Zip contains one `.ics` per track.
- Each has `BEGIN:VCALENDAR`, 4 `BEGIN:VEVENT` blocks, the correct track's times, and no events from the other track.

### 3. No CI workflow changes
`.github/workflows/test.yml` already runs `npm test` which executes the whole Vitest suite — new tests are picked up automatically.

## Technical details

- `beforeEach` resets `globalThis.__capturedBlobs = []` (already pattern used in pdfExport.test.ts).
- Blob → text via `await blob.text()` for CSV/ICS assertions.
- Count `BEGIN:VEVENT` occurrences with `text.match(/BEGIN:VEVENT/g)?.length`.
- Reuse the local `t()` resolver pattern (only used by the per-track zip API; CSV/ICS exports read locale JSON internally).
- No production code changes.

## Files touched
- `src/utils/__tests__/csvIcsExport.test.ts` (new)
