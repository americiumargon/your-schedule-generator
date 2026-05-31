## Problem

The "Add to Google Calendar" button only ever creates a single event, even when the schedule has many sessions. Reason: `buildGoogleCalendarUrl` puts the extra dates into a `recur=RDATE;...` parameter on Google's `calendar/render?action=TEMPLATE` URL. Google Calendar's template URL does **not** support `RDATE` — the `recur` param only honors a single `RRULE`. So GCal silently drops the extras and only the anchor session is created.

## Fix

Rework `src/utils/googleCalendar.ts` so the URL we hand to Google actually represents every session:

1. **Detect a clean weekly pattern** across the enabled sessions:
   - same `startTime` and `endTime` on every session
   - dates are exactly every N weeks (N ≥ 1) on the same set of weekdays
   - no per-session `location`/`notes` overrides
   - no `rolledFrom` exceptions
   
   When that holds, build a real `RRULE`:
   `RRULE:FREQ=WEEKLY;INTERVAL=N;BYDAY=MO,WE;COUNT=<sessions.length>` (or `UNTIL=<lastDate>`), keep the existing `DTSTART/DTEND/ctz` for the first session, and return that as the single URL. This is the case where one GCal link genuinely covers all sessions.

2. **Otherwise (irregular dates, mixed times, overrides, rolled sessions, or > MAX_SESSIONS)** the template URL physically cannot represent the schedule. Stop pretending it can:
   - Return a new result shape `{ url: null, reason: "not_representable" }` (keep the existing `too_many` and `empty` reasons).
   - In `ScheduleDisplay.handleAddToGoogle`, when we get `not_representable`, show a clear toast like *"Google Calendar can't import this schedule in one link — use the ICS export instead."* and do not open a window. Add the i18n key `toast.gcalNotRepresentable` to `en.json` and `id.json`.
   - This replaces the current misleading behavior where we open a URL that only creates session #1.

3. **Tidy up the existing flags**: `hasTimeConflicts` and `hasOverrides` only made sense under the broken RDATE path. With the new logic those cases now fall into `not_representable`, so remove the two flags from the success result and delete the now-unused toasts (`gcalTimeConflicts`, `gcalOverridesDropped`) from both locale files and from `handleAddToGoogle`.

4. **Keep the simple cases working**: 1 session → same single-event URL as today. N regular weekly sessions → one RRULE URL that creates all of them on import.

## Files touched

- `src/utils/googleCalendar.ts` — pattern detection + RRULE builder + new result shape.
- `src/components/ScheduleDisplay.tsx` — handle `not_representable`, drop the two stale warning branches.
- `src/locales/en.json`, `src/locales/id.json` — add `gcalNotRepresentable`, remove `gcalTimeConflicts` and `gcalOverridesDropped`.

## Out of scope

No new dependencies, no changes to ICS/CSV exports, no changes to generation logic. ICS remains the recommended path for irregular schedules.
