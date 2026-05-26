# Print the on-screen schedule directly

## Problem

Print currently outputs the form (page 1), a separate handout layout (page 2), and a trailing footer (page 3). Two layouts to maintain and the form shouldn't print.

The browser's default page header/footer (URL + app name + date) is fine to keep.

## Approach

Remove the dedicated `PrintableSchedule` handout. Print the existing on-screen schedule cards as-shown, hiding only the form and unrelated chrome.

### Changes

**`src/components/ScheduleDisplay.tsx`**
- Delete the `PrintableSchedule` component and its render call (and now-unused `Locale`/`TFunction` imports).
- Remove the `print:hidden` wrapper around the schedule content.
- Add `print:hidden` to:
  - Action row (Copy / CSV / ICS / Print / Share buttons + "N of M selected" line)
  - "Select all / Deselect all" row
  - Each session card's checkbox and edit (`Pencil`) button
- Add a print-only header above the cards (`hidden print:block`): `<h1>` event name, optional location, date range + session count.
- If `notes` is set, render a print-only notes block below the list.
- Keep the summary card and session cards visible.

**`src/pages/Index.tsx`**
- Read first, then wrap the form column (and any page header/footer outside the schedule area) in `print:hidden` so only the schedule prints.

**`src/index.css`**
- Replace `.print-handout` table rules with print rules for the schedule cards:
  - Keep `@page { margin: 16mm; size: A4 }` and the body color reset.
  - Session cards: light border, no shadow, `page-break-inside: avoid`.

**`src/locales/en.json` & `id.json`**
- Remove unused `printSubtitle`, `printGeneratedOn`, `printNotes`. Keep `printButton`.

## Out of scope

Custom @page headers/footers (browser defaults are fine), compact table layout, hiding deselected sessions, page numbers.
