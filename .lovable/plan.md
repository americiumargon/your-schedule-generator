## Copy as Markdown / Plain text

Today the Copy button writes one plain-text format to the clipboard. We'll turn it into a split control so users can pick the shape that fits where they're pasting (Notion, Slack, email, docs).

### UX (`src/components/ScheduleDisplay.tsx`)

Replace the single Copy button with a small **split button**:
- Left side: primary `Copy` button — copies in the **last-used format** (defaults to Markdown).
- Right side: a chevron that opens a `DropdownMenu` with three options:
  - **Plain text** — current behavior, unchanged.
  - **Markdown** — for Notion / GitHub / Slack code-formatting.
  - **Rich text (HTML)** — for email and Google Docs; copied via the Clipboard API with both `text/html` and `text/plain` so paste targets pick the best one.

Last choice persists in `localStorage` (`schedule.copyFormat`) so repeat users get one-click copy in their preferred format.

Toast message updates to `Copied as Markdown` / `Copied as plain text` / `Copied as rich text`.

### Format specs

All formats include: event name as title, optional location, each enabled session (number, date, time range), and optional notes block at the end.

**Plain text** (unchanged):
```
Event Name - Session 1: Monday, May 26, 2026, 09:00 - 11:00 @ Studio A
Event Name - Session 2: Wednesday, May 28, 2026, 09:00 - 11:00 @ Studio A

Notes go here
```

**Markdown**:
```
# Event Name

📍 Studio A

| # | Date | Time |
|---|------|------|
| 1 | Mon, May 26, 2026 | 09:00 – 11:00 |
| 2 | Wed, May 28, 2026 | 09:00 – 11:00 |

> Notes go here
```

**Rich text (HTML)** — same structure as Markdown but as a real `<h1>` + `<table>` + `<blockquote>`, so it pastes formatted into Gmail / Docs / Outlook. Plain-text fallback is the plain format above.

### Clipboard write

Plain and Markdown use `navigator.clipboard.writeText(...)`.
Rich uses `navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })])` with a try/catch fallback to `writeText(html)` on browsers without `ClipboardItem` (rare; mostly older Firefox).

### Code organization

New file `src/utils/copyFormats.ts` exports:
- `formatPlain(eventName, sessions, location, notes, t, locale): string`
- `formatMarkdown(...): string`
- `formatHtml(...): string`

`ScheduleDisplay` imports these, removes its inline string-building, and calls the right one based on the chosen format. Keeps the component lean and the formats unit-testable later.

### i18n (`src/locales/en.json` / `id.json`)

Add under `schedule`:
- `copyAs` — "Copy as"
- `copyFormatPlain` — "Plain text" / "Teks biasa"
- `copyFormatMarkdown` — "Markdown"
- `copyFormatRich` — "Rich text" / "Teks kaya"

Add under `toast`:
- `copiedPlain`, `copiedMarkdown`, `copiedRich` (replaces the single `copied` for these paths; old key kept as fallback).

The table header labels (`#`, `Date`, `Time`) use existing keys where possible (`schedule.session` → "Session", reused as column header is awkward, so add `schedule.colNumber`, `schedule.colDate`, `schedule.colTime`).

### Out of scope

- CSV/ICS/PDF copy variants — handled by their dedicated buttons / future PDF task.
- Per-session selection inside the copied output — already respected via `enabledSessions`, no change.
- Customizable templates.
