# Branded PDF Export

Add a new export format: a branded PDF of the generated schedule with a customizable logo, organization name, tagline, accent color, and footer. Branding settings persist in localStorage so users set them once and reuse them.

## Scope

In v1:
- Single set of branding (one profile), stored in localStorage.
- One clean PDF layout, header + info block + sessions table + footer.
- EN/ID localized strings via existing i18n.

Out of scope (later):
- Multiple brand profiles, custom fonts, watermarks, layout variants.

## Files

### New
- `src/utils/branding.ts` — types + `loadBranding()` / `saveBranding()` / `clearBranding()` against `localStorage` key `branding:v1`. Shape:
  ```ts
  { logoDataUrl?: string; orgName?: string; tagline?: string; accentColor?: string; footerText?: string; }
  ```
- `src/utils/pdfExport.ts` — `exportToPDF(sessions, eventName, language, opts, branding)` using `jspdf` + `jspdf-autotable`.
  - Header band tinted with `accentColor` (fallback to current theme primary, e.g. `#0ea5e9`).
  - Logo: base64 data URL, fit into max 40pt tall × 160pt wide, preserve aspect.
  - Info block: event name, location, timezone, session count, date range.
  - Table: `#`, Date, Day, Time, Location (if any), Notes (if any). Repeating header row, page numbers in footer, footer text centered.
  - Localized column headers and labels via i18n keys.
- `src/components/BrandingSection.tsx` — collapsible section rendered inside `ScheduleForm` (or `Index` near form). Fields:
  - Logo file input (accept `image/png,image/jpeg,image/svg+xml`, max ~500KB; read as data URL).
  - Live mini-preview of the header bar (logo + org name + tagline tinted with accent color).
  - Org name, tagline, footer text inputs.
  - Accent color picker (`<input type="color">`).
  - "Reset branding" button.
  - On any change, persist via `saveBranding()`.

### Edited
- `src/components/ScheduleDisplay.tsx` — add "Export PDF" button next to existing CSV/ICS buttons. Wire to a new `onExport("pdf", ...)` case.
- `src/pages/Index.tsx` — extend `handleExport` to handle `"pdf"`: load branding from localStorage, call `exportToPDF(...)`, toast `t('export.successPdf')`.
- `src/components/ScheduleForm.tsx` (or `Index.tsx`) — mount `<BrandingSection />` as a collapsed-by-default block above the Generate button.
- `src/locales/en.json` and `src/locales/id.json` — add keys:
  - `branding.title`, `branding.logo`, `branding.orgName`, `branding.tagline`, `branding.accentColor`, `branding.footer`, `branding.reset`, `branding.logoTooLarge`, `branding.logoInvalid`, `branding.preview`
  - `export.pdf`, `export.successPdf`
  - `pdf.sessions`, `pdf.dateRange`, `pdf.location`, `pdf.timezone`, `pdf.page`, `pdf.col.num`, `pdf.col.date`, `pdf.col.day`, `pdf.col.time`, `pdf.col.location`, `pdf.col.notes`

### Dependencies
- `bun add jspdf jspdf-autotable`

## Behavior details

- **No branding set** → PDF still works: text-only header with event name, neutral accent (theme primary).
- **Logo handling** → validate MIME and size before saving; reject >500KB with a toast. Auto-fit dimensions; never stretch.
- **Long content** → autoTable handles wrapping and pagination; repeat header row per page; footer shows `Page X / Y` and footer text.
- **Filename** → `{eventName || 'schedule'}.pdf`, sanitized.
- **Persistence** → branding survives reload, independent of any specific schedule, shared across all exports.

## Out of scope confirmation

Country holiday presets are explicitly deferred to a follow-up task.
