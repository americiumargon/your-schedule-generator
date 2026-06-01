## Test results

Ran the full suite and inspected the live preview.

- **Automated tests**: 105/105 pass across 7 files (validation, validationEdgeCases, projectGenerator, shareLinkDraft, exportE2E, csvIcsExport, pdfExport).
- **Live preview**: app loads, form renders, language toggle and theme toggle present, empty state correct.
- **One real defect surfaced**: the PDF exporter logs `Of the table content, 211 units width could not fit page` on every combined-scope export. The table truncates Location/Notes content silently in landscape A4 when both columns are present (and gets worse with the Track column added).

No other functional regressions were found. Generation logic, share links, drafts, CSV/ICS, per-track export, project generator, and edge-case validation are all green.

## Root cause

In `src/utils/pdfExport.ts` (lines 304-311) the column widths are hardcoded:

```text
#  28 | date 70 | day 36 | time up to 140 | track 90 | location ? | notes ?
```

Fixed widths total up to **364pt** before Location/Notes. Landscape A4 inner width is ~770pt, leaving ~400pt to split between Location and Notes — but autoTable's `linebreak` overflow pushes content past the right margin when either cell has long text, hence the 211pt overflow warning. Portrait orientation (if ever used) overflows even sooner.

## Plan

**Single fix, scoped to `src/utils/pdfExport.ts`:**

1. Compute the available inner page width from `doc.internal.pageSize.getWidth() - 2 * marginX`.
2. Subtract the fixed columns (`#`, date, day, time, track-if-present) to get remaining width.
3. Split the remainder between Location and Notes:
   - both present → 40% / 60%
   - only one present → 100% to that column
4. Pass the computed widths into `columnStyles` for Location and Notes (instead of leaving them unconstrained).
5. Tighten `timeColW` upper bound to `120` so the time column doesn't starve the flex columns.
6. Keep `overflow: "linebreak"` so long values wrap inside their cell instead of overflowing the page.

**Test additions in `src/utils/__tests__/pdfExport.test.ts`:**

- Add a case with long location + long notes strings and assert the autoTable warning is not emitted (spy on `console.log` / capture `doc`'s warnings list) and that `doc.getNumberOfPages()` stays reasonable.
- Add a case with Track + Location + Notes all present to lock in the new flex sizing.

**Out of scope:** No UI changes, no changes to CSV/ICS/Google Calendar/share-link logic, no schema changes. All other features are verified working.

## Files

- `src/utils/pdfExport.ts` — column-width calculation
- `src/utils/__tests__/pdfExport.test.ts` — two new assertions
