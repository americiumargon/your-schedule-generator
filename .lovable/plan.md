## Verify CSV/ICS/PDF exports for Combined and Per-Track ZIP scopes

Exports are browser-side (Blob + anchor.click + jsPDF). To verify without clicking through the UI, run a headless Node script that imports the export functions, stubs the DOM APIs, captures the written file payloads, and inspects them.

### Approach

1. Add a one-off script `scripts/verify-exports.mjs` (kept out of the app bundle, removed after verification) that:
   - Boots a minimal jsdom-like shim: `globalThis.document`, `URL.createObjectURL`, `URL.revokeObjectURL`, and an `HTMLAnchorElement.click` that records `{ filename, blob }`.
   - Imports `generateProject` from `src/utils/projectGenerator.ts`, `exportToCSV` / `exportToICS` / `exportToPDF` from the app, and `exportPerTrackZip` from `src/utils/perTrackExport.ts`.
   - Builds a `ProjectState` with two tracks (e.g. "Beginner" Mon/Wed 09:00–10:00, "Advanced" Tue/Thu 18:00–19:30), 4-week range, no holidays.
   - Runs all 6 cases: {csv, ics, pdf} × {combined, perTrack}.
2. For each captured blob:
   - **CSV / ICS combined** — assert UTF-8 text contains both `Beginner` and `Advanced`, the right number of rows/`BEGIN:VEVENT`s, and the `Track:` description line.
   - **PDF combined** — load with `pypdf`, assert page count > 0 and extracted text mentions both track names and the new "Track" column header.
   - **ZIP per-track** — unzip in memory (`jszip.loadAsync`), assert exactly two entries with the expected basenames, then re-run the CSV/ICS/PDF assertions on each entry (no other track's name should leak in).
3. Use the QA loop from the PDF skill on the combined PDF and one per-track PDF:
   - `pdftoppm -jpeg -r 150 out.pdf page` and read each image for clipping, overlap, missing column, etc.
4. Report: a table of 6 cases with pass/fail and any captured anomalies.

### Out of scope
- UI click-path verification (covered by the type-checked wiring already shipped).
- Reminder/timezone variations beyond the defaults.

### Deliverable
A short verification report listing each scope/format combination, what was checked, and any defects found (with fixes if any). The temporary script is deleted afterwards.