# Make the schedule form easier for everyone

Restructure the form so casual users see only what they need, while power users can expand "Advanced" to access the deeper controls. Pair with visual polish: clear section headings, icons, and consistent spacing.

## What users will see

**Always visible (the essentials):**
1. Activity name
2. Start date
3. Generate by: number of sessions **or** end date
4. Recurring days (the weekday picker)
5. One time slot (start + end time)
6. Big "Generate Schedule" button

**Collapsible: "Advanced options" (closed by default)**
Grouped into 3 labeled sub-sections with icons:

- **Repeat pattern** — recurrence selector (weekly / every N weeks / monthly by weekday / monthly by date) and its dependent controls (ordinals grid, days-of-month grid). Default stays "Every week".
- **Time slots & holidays** — add multiple slots per day, pick holidays, choose skip vs. roll-forward.
- **Event details & calendar** — location, notes, reminder, timezone.

If a user has set any non-default value in a section (e.g. picked holidays, switched recurrence), that section auto-expands on load so nothing feels hidden.

## Visual polish

- Section headings with small lucide icons (`Calendar`, `Repeat`, `Clock`, `MapPin`) and a thin divider above each.
- Consistent vertical rhythm (`space-y-5` inside sections, `space-y-8` between sections).
- Helper text under each label in `text-xs text-muted-foreground` explaining the field in one sentence.
- "Advanced options" uses shadcn `Collapsible` with a chevron and a subtle badge showing how many advanced settings are customized (e.g. "Advanced options · 2 customized").
- Mobile: form already stacks; tighten padding and make the Generate button sticky at the bottom on small screens.

## Technical details

Files to change:
- `src/components/ScheduleForm.tsx` — restructure JSX into `<EssentialsSection />`, `<AdvancedSection />` with three `<Collapsible>` sub-groups. No changes to state shape, Zod schemas, or `onGenerate` payload — purely presentational refactor.
- `src/locales/en.json` & `src/locales/id.json` — add keys: `form.advanced.title`, `form.advanced.customizedBadge`, `form.sections.repeat`, `form.sections.slotsHolidays`, `form.sections.details`, and short helper-text strings per field.
- `src/index.css` — no changes expected; rely on existing tokens.

Auto-expand logic: a small helper `hasCustomValues(section)` checks against defaults (e.g. recurrence !== weekly/1, holidays.length > 0, timeSlots.length > 1, location/notes/reminder/timezone changed). Used both for the initial open state and the badge count.

No changes to:
- `scheduleGenerator.ts`, `shareLink.ts`, `googleCalendar.ts`, `copyFormats.ts`
- `ScheduleDisplay.tsx`
- Share links (full backward compatibility preserved since payload is unchanged)

## Out of scope (can come later)

- Smart presets ("Weekly class", "Daily standup")
- Live preview of next 3 sessions as you type
- Wizard / multi-step flow

Approve to implement.