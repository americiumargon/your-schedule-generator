## PDF / Printable view

Add a **Print / Save as PDF** button to the schedule that opens the browser's print dialog with a clean, handout-styled layout. Users get a PDF for free via "Save as PDF" in any modern browser — no jsPDF dependency, no extra bundle weight.

### UX (`src/components/ScheduleDisplay.tsx`)

- Add a new `Print` button to the action row, next to Copy / CSV / ICS, using the `Printer` icon from lucide-react.
- Clicking it calls `window.print()`. Only currently **enabled** sessions are included (same filter as other exports).
- Toast on empty selection mirrors CSV/ICS behavior.

### Print layout

Build a dedicated print-only block that renders alongside the screen UI but is only visible when printing. Approach: a `<div className="hidden print:block">` containing the handout, and `print:hidden` on the interactive screen content.

Handout content (top to bottom):
- Event name as `<h1>`.
- Location line (if present) with 📍 prefix.
- Date range + total session count (reuse the summary numbers already computed).
- Clean table: `#`, `Date` (e.g. `Mon, May 26, 2026`), `Time` (e.g. `09:00 – 11:00`). One row per enabled session.
- Notes block at the bottom (if present), in a bordered box.
- Small footer with generation date.

### Print stylesheet (`src/index.css`)

Add a `@media print` block:
- `body { background: white; color: black; }`
- Hide app chrome: header, language toggle, form, action buttons, edit controls.
- Set page margins via `@page { margin: 16mm; size: A4; }`.
- Table: full width, thin borders, `page-break-inside: avoid` on rows, repeating `<thead>`.
- Avoid page break inside the notes block.
- Hide URL/date headers/footers is browser-controlled — we don't fight it, but our own footer covers attribution.

Tailwind's `print:` variants handle the show/hide split; only the `@page` rule and a couple of table-print rules need raw CSS.

### i18n (`src/locales/en.json` / `id.json`)

Add under `schedule`:
- `printButton` — "Print" / "Cetak"
- `printSubtitle` — short tagline shown under the title in the handout, e.g. "Session schedule" / "Jadwal sesi"
- `printGeneratedOn` — "Generated on {{date}}" / "Dibuat pada {{date}}"

Reuse existing `colNumber`, `colDate`, `colTime`, `summary.totalSessions`, etc.

### Code organization

Keep the print layout inline in `ScheduleDisplay.tsx` — it's tightly coupled to the same `sessions` + `enabledSessions` state and splitting it would just add prop drilling. A small `<PrintableSchedule />` sub-component in the same file keeps JSX readable.

### Out of scope

- jsPDF / pdfmake generated files (heavier, can come later if browser print proves insufficient).
- Custom page sizes / per-page customization.
- Logos / branding upload for the handout header.
- Multi-column / poster layouts.
