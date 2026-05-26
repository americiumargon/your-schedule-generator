# Google Calendar link — single event with multiple dates

## Approach

Build one Google Calendar event using Google's `render?action=TEMPLATE` URL with a `recur` parameter containing iCal `RDATE` lines — one for each selected session. The first session anchors `dates=` (start/end), and all subsequent sessions are added as RDATEs. This opens **one tab** with **one event** that Google Calendar shows on every selected date.

Time handling: a single event has one start/end time. If all selected sessions share the same `startTime`/`endTime`, we use RDATE. If users have edited individual sessions to different times, we fall back to opening the link anyway but show a toast warning that off-time sessions will use the anchor time, and suggest ICS for full fidelity.

## Changes

**`src/utils/googleCalendar.ts`** (new)
- `buildGoogleCalendarUrl(eventName, sessions, location?, notes?, timezone?)` returns a `https://calendar.google.com/calendar/render?action=TEMPLATE&...` URL.
- Params:
  - `text` = event name
  - `dates` = `YYYYMMDDTHHmmss/YYYYMMDDTHHmmss` of the first session (floating local time, matches our ICS approach)
  - `ctz` = timezone (if set and not UTC)
  - `details` = notes (optional)
  - `location` = location (optional)
  - `recur` = `RDATE;TZID=<tz>;VALUE=DATE-TIME:<dt1>,<dt2>,...` listing every session **after the first** at the anchor time. (If tz is UTC/unset, omit `;TZID=...` and append `Z` to each datetime.)
- Return `{ url, hasTimeConflicts: boolean }` where `hasTimeConflicts` is true if any session's start/end differs from the first.
- Cap RDATE list at ~50 sessions to stay under URL length limits; if exceeded, return `{ url: null, reason: 'too_many' }` and caller falls back to suggesting ICS.

**`src/components/ScheduleDisplay.tsx`**
- Import `CalendarPlus` icon from lucide-react.
- Add a new "Add to Google" button in the action row (next to ICS/Print/Share, `print:hidden`).
- Handler: builds URL from `enabledList`; if `null` (too many), `toast.error` and suggest ICS; if `hasTimeConflicts`, `toast.warning` then `window.open(url, '_blank', 'noopener')`; otherwise just open.

**`src/locales/en.json` & `id.json`**
- Add `schedule.googleButton` ("Add to Google" / "Tambah ke Google").
- Add `toast.gcalTooMany` and `toast.gcalTimeConflicts` strings.

## Out of scope

- Per-session "Add to Google" links on each card.
- Trying to detect a clean weekly RRULE pattern (RDATE works universally and is simpler).
- Multi-tab bulk open for >50 sessions.
- Editing the event time per RDATE (Google's URL API doesn't support per-instance overrides; ICS export already covers that).

## Technical notes

- RDATE example sent to Google: `recur=RDATE;TZID=America/New_York;VALUE=DATE-TIME:20260601T090000,20260603T090000,20260605T090000`
- URL-encode the entire `recur` value once; newlines are not needed since it's a single property.
- Reuse the floating-local-time formatter from `scheduleGenerator.ts` (extract or duplicate the small helper).
