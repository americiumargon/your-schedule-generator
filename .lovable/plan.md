## Fix ICS injection via timezone & slot label

Sanitize user-controlled strings before embedding them into ICS output in `src/utils/scheduleGenerator.ts`.

### Changes

**`src/utils/scheduleGenerator.ts`**
1. Add a `sanitizeTzid(tz)` helper that:
   - Strips all CR/LF characters and any control chars.
   - Validates against `Intl.supportedValuesOf('timeZone')` when available; falls back to a regex allowing only `[A-Za-z0-9_+\-/]`.
   - Returns `"UTC"` if the value is invalid/empty.
2. In `exportToICS`, run `tz` through `sanitizeTzid` before using it in `;TZID=${tz}` and `TZID:${tz}`. If sanitized result is `"UTC"`, keep the existing UTC code path (no VTIMEZONE, Z-suffixed times).
3. Sanitize `session.slotLabel` in the `UID` line by stripping CR/LF and any chars outside `[A-Za-z0-9_-]` (UID must be a single line per RFC 5545). Summary/description already go through `escapeICS`, which handles newlines — no change needed there.

### Out of scope
- No changes to `shareLink.ts` schema (defense-in-depth lives at the export boundary; tightening the schema is optional and would reject legitimate IANA names containing `/`).
- No UI/i18n changes.
- CSV export is unaffected (already quoted/escaped).
