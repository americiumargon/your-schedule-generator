## Goal
Add an edge-case test file `src/utils/__tests__/validationEdgeCases.test.ts` that locks down behavior for timezones, DST boundaries, and meeting frequency patterns. No production code changes.

## Coverage

**Timezone edge cases (`validateTimezone` + `exportToICS` round-trip)**
- Accepts canonical IANA zones: `UTC`, `America/New_York`, `Asia/Jakarta`, `Pacific/Auckland`, `Etc/GMT+12`
- Accepts legacy aliases the runtime recognizes (`US/Pacific`) — assert with try/catch on Intl in the test so it adapts to runtime
- Rejects injection attempts: `"UTC\r\nBEGIN:VEVENT"`, `"UTC; DROP"`, `"\u0000UTC"`, `"  "`, `""`, 65+ char string
- Rejects case-variant garbage: `"utc/notreal"`, `"America/Nowhere"`
- `exportToICS` with a valid non-UTC TZ emits `DTSTART;TZID=<tz>:...` (floating local time, no `Z`) and a matching `VTIMEZONE` block
- `exportToICS` with `UTC` emits `DTSTART:...Z` and no `VTIMEZONE`
- `exportToICS` throws `ExportValidationError` when given an injected TZ

**DST boundary cases (ICS output stability)**
- US spring-forward weekend (2026-03-08, America/New_York): session at 09:00 still serializes as `T090000` with `TZID=America/New_York` (floating local — does not shift)
- US fall-back weekend (2026-11-01, America/New_York): same — 09:00 stays 09:00 in the ICS string
- EU spring-forward (2026-03-29, Europe/London): 09:00 session stays `T090000`
- Southern hemisphere transition (2026-04-05, Australia/Sydney): 09:00 stays `T090000`
- Generate a weekly schedule crossing a DST boundary and assert all session local times are unchanged (no implicit conversion)
- UTC export of a session on a DST date produces a deterministic `Z` timestamp matching `Date.toISOString()`

**Meeting frequency / recurrence patterns (`generateSchedule` + validators)**
- Weekly interval 1, 2, 3, 4, 12 — produce sessions spaced by `interval` weeks; first session on `startDate` when it matches a selected weekday
- Weekly with multiple weekdays + interval 2 — sessions appear only on selected DOWs in matching weeks
- Monthly-by-weekday: 1st Monday of each month for 6 months, last Friday of each month for 6 months (`-1`)
- Monthly-by-weekday with multiple ordinals (`[1, 3]`) — 2 sessions per month
- Monthly-by-date: days `[1, 15]`, last day (`-1`) — verify last-day collapses to actual `getDaysInMonth` (Feb 28/29, April 30)
- Monthly-by-date with day 31 falls back to last day in 30-day months
- End-date mode: stops at or before `endDate`; count mode: respects `MAX_MEETINGS = 366`
- Holiday `skip` vs `rollForward`: rolled session lands on next allowed weekday within 14 days; if no slot found, session is dropped
- Leap-year February (2024-02-29) handled correctly for monthly-by-date `-1`
- `validateMeetings` boundaries: 1, 366 accepted; 0, 367, `"0"`, `"  5  "` (whitespace trim), `"1e2"` (scientific) rejected as expected
- `validateInterval` and `validateOrdinals` boundary fuzz with arrays containing duplicates, negatives, floats

## Files
- new: `src/utils/__tests__/validationEdgeCases.test.ts`
- no production code changes

## Out of scope
- Changing generator behavior; tests document current behavior. If a test reveals a real bug, surface it in chat rather than silently editing the generator.
