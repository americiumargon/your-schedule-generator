## Goal

Make the PDF logo feature discoverable from the export controls (no longer buried in the Branding panel) and produce richer PDFs that lead with a cover page featuring a large logo, then carry a small repeating logo in the header of every following page.

## UX changes

1. **Quick logo button next to the PDF export button** (`ScheduleHeader` / wherever `exportToPDF` is triggered from `Index.tsx`):
   - New `LogoQuickUpload` button: shows "Add logo" (with upload icon) when no logo is set, or a small logo thumbnail + "Change" / "Remove" menu when one is set.
   - Clicking opens a file picker reusing the same validation as `BrandingSection` (PNG/JPEG/SVG, ≤500 KB).
   - Tooltip: "Used on PDF cover and header. Manage full branding below."
   - Writes through `saveBranding({ logoDataUrl })` so the existing Branding panel stays in sync.

2. **Branding panel** keeps all existing fields; gets a small hint pointing to the new quick-upload button so users understand they're the same logo.

3. **PDF export dialog/button area**: add a checkbox "Include cover page" (default: on when a logo OR org name is set, off otherwise). Persisted in `branding` as `coverPage?: boolean` (extends `Branding` interface).

## PDF rendering changes (`src/utils/pdfExport.ts`)

1. **Cover page** (rendered first when `branding.coverPage !== false` AND (`logoDataUrl` or `orgName`)):
   - Full A4 page.
   - Accent-colored top band (~40% page height) OR full-bleed accent background — pick band for print friendliness.
   - Large centered logo (max 280×180 pt, preserving aspect).
   - Below logo: org name (24pt bold), tagline (13pt), event name (16pt), date range, session count, location, timezone.
   - Footer of cover page: `footerText` if set.
   - Call `doc.addPage()` before continuing to the existing schedule page.

2. **Repeating header logo** on schedule pages (already partly there in `didDrawPage`):
   - Extend the existing thin top strip on pages 2+ to also draw a small logo (max height 14 pt, max width 60 pt) on the left of the strip when `logoDataUrl` is present.
   - Page 1 of the schedule (page 2 of the PDF when cover is on) already renders the tall header band with logo — no change.

3. **Skip the existing tall header band on page 1** when the cover page is enabled, so we don't repeat the logo immediately. Replace it with a slim accent strip identical to subsequent pages.

## Data / types

- Extend `Branding` in `src/utils/branding.ts`:
  ```ts
  coverPage?: boolean;
  ```
- No migration needed (localStorage is forward-compatible; missing field treated as default).

## i18n

Add keys to `src/locales/en.json` and `id.json`:
- `branding.quickUpload`, `branding.quickChange`, `branding.quickRemove`, `branding.quickHint`
- `pdf.includeCover`, `pdf.cover.event`, `pdf.cover.dates`, `pdf.cover.sessions`

## Tests

- Extend `src/utils/__tests__` with a small unit test that constructs a fake branding with a 1×1 PNG data URL and calls `exportToPDF`, asserting:
  - `doc.getNumberOfPages()` increases by 1 when `coverPage` is true.
  - Does not throw when logo is omitted.
- No snapshot of binary PDF — assert structural side effects only.

## Out of scope

- Per-track logos for `perTrackExport` (can be a follow-up).
- Server-side logo storage (project is fully client-side per project memory).
- Changing CSV / ICS exports.

## Files touched

- `src/utils/branding.ts` — add `coverPage` field.
- `src/utils/pdfExport.ts` — cover page + small repeating header logo + skip tall band when cover is on.
- `src/components/BrandingSection.tsx` — hint copy, cover-page toggle.
- `src/components/LogoQuickUpload.tsx` — new component.
- `src/pages/Index.tsx` (or wherever the PDF export button lives) — render `LogoQuickUpload` next to the PDF export button + cover toggle.
- `src/locales/en.json`, `src/locales/id.json` — new strings.
- `src/utils/__tests__/pdfExport.test.ts` — new minimal tests.
