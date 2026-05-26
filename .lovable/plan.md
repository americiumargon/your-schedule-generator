# Three upgrades, shipped one at a time

I'll build these in priority order. After each one ships and you confirm it works, I'll start the next. This keeps each change small, reviewable, and easy to roll back.

## Priority order (and why)

1. **Multiple time slots per day** — highest ROI. Unlocks a real-world use case (morning + evening classes) that today forces users to generate two separate schedules. Touches the most files but each touch is small.
2. **Auto-reschedule on holiday (roll forward)** — small surface area, big UX win. Most users *want* the session moved, not deleted. Easy to add once we're already in the generator.
3. **Recurrence patterns beyond weekly** — biggest UI surface (new selector + ordinal/day-of-month controls). Power-user feature. Worth doing last so the first two ship fast.

Each step preserves today's defaults so existing share links and the current UX don't change unless the user opts in.

---

## Step 1 — Multiple time slots per day

**Form**
- Replace the single Start/End time row with a `<TimeSlotList>`: each slot is `{ startTime, endTime, label? }`. Buttons: `+ Add time slot`, trash to remove. Min 1, max 6.
- Validate each slot with the existing time regex; require `start < end` per slot.

**Generator (`scheduleGenerator.ts`)**
- Replace `startTime`/`endTime` in `GenerateScheduleOptions` with `timeSlots: Array<{ startTime, endTime, label? }>`.
- For every accepted date, emit one `Session` per slot. `sessionNumber` stays globally sequential. Add `slotLabel?: string` to `Session`.
- In `count` mode, the target counts sessions (not dates), so 10 sessions × 2 slots = 5 dates.

**Display + exports**
- `ScheduleDisplay`: show the slot label as a small `<Badge>` next to the time range when present.
- CSV/ICS/Google/Copy: append slot label to the subject/summary when present (e.g. `Yoga - Session 3 (Morning)`).

**Share link**
- Add `timeSlots` to `ShareFormState` + token (`ts: [{s,e,l?}]`). Backward compat: if a link only has `st`/`et`, synthesize a single slot.

**i18n** — new keys: `form.timeSlots.title/add/remove/labelPlaceholder`, `schedule.slotBadge`.

---

## Step 2 — Auto-reschedule on holiday

**Form**
- In the Holidays section, add a `<RadioGroup>` "When a session falls on a holiday":
  - Skip the session (default — current behavior)
  - Move to the next available weekday

**Generator**
- Add `holidayBehavior: "skip" | "rollForward"` to options.
- On `rollForward`: when a candidate date is a holiday, walk forward up to 14 days, accept the first date that is in `selectedDays` and not a holiday. If none found, fall back to skip and surface a toast warning. Attach `rolledFrom: Date` to the session.

**Display + exports**
- `ScheduleDisplay`: small muted "moved from MMM d" line under the date when `rolledFrom` is set.
- ICS/CSV `DESCRIPTION` includes "Moved from {date}" when applicable.

**Share link** — add `hb: "skip" | "rollForward"`; default `skip` for legacy links.

**i18n** — `form.holidayBehavior.label/skip/rollForward/description`, `schedule.rolledFromBadge`, `toast.rollForwardFailed`.

---

## Step 3 — Recurrence patterns beyond weekly

**Form**
- Add a Recurrence `<Select>` above the weekday list:
  - Every week (default)
  - Every 2 / 3 / 4 weeks
  - Monthly by weekday (1st / 2nd / 3rd / 4th / Last + chosen weekday(s))
  - Monthly by date (chip grid 1–31 + "Last day")
- The weekday checkboxes stay visible for weekly + monthlyByWeekday; for monthlyByDate they're replaced by the day-of-month chip grid.

**Generator**
- Add discriminated union:
  ```ts
  recurrence:
    | { type: "weekly"; interval: 1 | 2 | 3 | 4 }
    | { type: "monthlyByWeekday"; ordinals: number[] }   // 1..4, -1 for Last
    | { type: "monthlyByDate"; daysOfMonth: number[] }   // 1..31, -1 for Last
  ```
- Build a date-candidate generator per recurrence type, then run the existing holiday + slot-expansion pipeline on it.
- `weekly` with `interval > 1`: accept date if it falls on a selected weekday AND `weekIndex % interval === 0` measured from `startDate`'s week.
- `monthlyByWeekday`: for each month in range, compute the ordinal occurrences of each selected weekday and keep those whose ordinal is in `ordinals`.
- `monthlyByDate`: for each month, take `daysOfMonth`; clamp values > the month's last day (so "31" becomes Feb 28/29).

**Share link** — add `rec` to the token; legacy links default to `{ type: "weekly", interval: 1 }`.

**i18n** — `form.recurrence.*` for all labels.

---

## Out of scope (across all three)

- Drag-to-reschedule, per-session slot overrides (edit pencil already handles that), RRULE-style ICS output (we already expand to discrete events for max portability), backward-walking holiday rollover.

---

Reply "go" (or "start with step 1") and I'll implement step 1 only, verify it, and pause for your sign-off before moving on.
