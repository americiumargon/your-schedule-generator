## Verify PDF export works

Reuse the headless-export approach from the prior verification, scoped to PDF only.

### Steps

1. Recreate `scripts/verify-pdf-export.mjs` with minimal DOM shims (`document`, `URL.createObjectURL/revokeObjectURL`, anchor `click` capture).
2. Import `generateProject` from `src/utils/projectGenerator.ts`, `exportToPDF` from `src/utils/pdfExport.ts`, and `exportPerTrackZip` from `src/utils/perTrackExport.ts`.
3. Build a `ProjectState` with two tracks:
   - "Beginner" Mon/Wed 09:00–10:00
   - "Advanced" Tue/Thu 18:00–19:30
   - 4-week range, no holidays, default reminder/timezone.
4. Run two cases:
   - **Combined PDF** — single file capture, save to `/tmp/qa/combined.pdf`.
   - **Per-track ZIP** — unzip in memory (`jszip`), save each entry to `/tmp/qa/<track>.pdf`.
5. Assertions:
   - File written and non-empty.
   - `pypdf` extracts text containing project name, "Track" column header, and (combined) both track names; per-track files contain only their own track name.
   - Page count > 0.
6. Visual QA: `pdftoppm -jpeg -r 150` on each PDF and inspect every page for clipping, overlap, missing columns, or font box-glyphs.
7. Report a 3-row pass/fail table (Combined, Beginner per-track, Advanced per-track) with any defects + fixes.
8. Delete the temporary script and `/tmp/qa/` artifacts when done.

### Out of scope
CSV/ICS verification, UI click-path testing, branding/logo variations.

### Deliverable
A short pass/fail summary per case with anomalies noted.