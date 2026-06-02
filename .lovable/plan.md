## 1. Remove prefill from the form

Currently the form prefills several fields on a fresh load (no share link, no recent):
- Start date → next Monday
- First track's time slot → 09:00 / 10:00
- Number of sessions → "8"
- Track name → "Class 1"

Changes in `src/components/ScheduleForm.tsx`:
- `startDate` initial state: `undefined` (drop the `nextMonday(new Date())` fallback).
- `defaultDraft(...)`: don't seed `timeSlots` with 09:00/10:00, don't seed `numberOfMeetings = "8"`. Leave them empty so the user fills them in.
- Track name: leave blank by default (only auto-mirror from project name as it does today once the user types one).
- Keep existing validation — empty start date / empty time / empty session count already surface as errors on submit, so no business-logic changes are needed.
- Share-link / recent-schedule hydration paths are untouched — those still populate fields when present.

## 2. Analog (circular) clock time picker

Replace every `<Input type="time">` used for `startTime` / `endTime` (the single-slot row near line 836 and the multi-slot rows near line 997) with a new `TimePickerClock` component.

New file: `src/components/TimePickerClock.tsx`
- Trigger: a `Button` styled like the current input showing `HH:mm` (or a placeholder when empty), with a small clock icon.
- Opens a `Popover` containing a Material-style two-step analog clock:
  - Step 1: 12 hour numbers arranged on a circle (with inner ring 13–00 for 24h), tap to select hour.
  - Step 2: minute ring (00, 05, 10, … 55), tap to select minute. Auto-advances from hour → minute, then closes and emits `"HH:mm"`.
  - Drag support on the clock hand (pointer events → angle → nearest slot) plus tap-to-select.
  - AM/PM toggle hidden (we keep 24h since the rest of the app and ICS export use 24h strings).
- Pure SVG + Tailwind tokens (`bg-primary`, `text-primary-foreground`, `border-border`, etc.) — no new npm dependency.
- Keyboard fallback: a tiny `HH:mm` text input below the clock for accessibility and power users, so screen readers and tests still work.
- Emits the same `"HH:mm"` string the rest of the code already consumes, so `projectGenerator`, validation, ICS/CSV export, and tests need no changes.

Wire-up in `ScheduleForm.tsx`:
- Import and use `<TimePickerClock value={slot.startTime} onChange={(v) => updateSlot(idx, { startTime: v })} ariaLabel={t('form.startTime')} />` in both the single-slot block and the multi-slot block.
- Keep the existing `<Label>`s and validation messages.

## 3. Tests

- Update `e2e/mobile.spec.ts` and `e2e/schedule.spec.ts` only if they target `input[type="time"]` directly — switch to the new trigger + clock interaction, or to the keyboard-fallback text input (preferred, less brittle).
- Add a small unit/component test for `TimePickerClock`: clicking an hour then a minute fires `onChange("HH:mm")`; controlled `value` renders the hand at the right angle.
- Adjust any unit test in `ScheduleForm` that relied on the 09:00/10:00 / "8" defaults to set values explicitly.

## Technical notes
- No new dependencies; SVG math handled inline.
- All colors via semantic Tailwind tokens (`hsl(var(--primary))` etc.), respects light/dark mode.
- Mobile-friendly: pointer events, ~280px clock face, large tap targets.
- No changes to data model, share-link encoding, or export pipelines.

## Out of scope
- The date picker UI (user only called out start/end time).
- The 24h vs 12h choice — staying 24h to match the rest of the app. Happy to add an AM/PM mode if you'd like.
