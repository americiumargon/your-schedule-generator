
# Inline validation, recent schedules, mobile polish, dark mode

Four focused improvements. None change the schedule generation logic or share-link payload.

## 1. Inline validation (replace error toasts)

Today every validation problem fires a toast. Move to field-level errors so users see what to fix without dismissing popups.

- Track an `errors` state object in `ScheduleForm` (e.g. `{ eventName?: string; startDate?: string; numberOfMeetings?: string; endDate?: string; selectedDays?: string; ordinals?: string; daysOfMonth?: string; timeSlots?: string }`).
- On submit, run the existing Zod + manual checks but collect errors instead of returning on the first one. Show each one as a small red helper line under the field (use shadcn pattern: red border + `text-sm text-destructive` message).
- Clear a field's error as soon as the user edits that field.
- Auto-scroll to and focus the first invalid field on submit.
- Keep ONE toast for the catch-all "no sessions fit in this date range" case (it's a result, not a field error).
- Auto-expand the "More options" section if any error lives inside it so users can see what's wrong.
- Add translation keys for the same messages already under `form.validation.*` (no new copy needed).

## 2. Recent schedules history

Save the last 5 generated schedules locally so users can reload or duplicate them.

- New util `src/utils/recentSchedules.ts` with `loadRecent()`, `saveRecent(state)`, `removeRecent(id)`, `clearRecent()`. Stored in `localStorage` under key `schedule-generator:recent`, JSON array of `{ id, name, createdAt, formState }` where `formState` is the existing `ShareFormState` shape. Cap at 5; new entries push the oldest out.
- On successful generate in `Index.tsx`, append the current `lastFormState` plus the activity name and timestamp.
- New component `src/components/RecentSchedules.tsx` rendered in the empty-state area of the right column (only when there are saved entries and no current schedule). Shows a compact list: name, "3 days ago" via `date-fns/formatDistanceToNow`, plus "Load" and remove (×) buttons. A small "Clear history" link at the bottom.
- Clicking Load sets `initialFormState` on `ScheduleForm` (same path the share-link decoder uses) and scrolls the form into view. The form already supports rehydration from this shape, so no extra wiring.
- New i18n keys under `recent.*`: `title`, `empty`, `load`, `remove`, `clearAll`, `createdAgo` (e.g. "Created {{ago}}").

Dates inside the JSON serialize via `toISOString()` and parse back with `new Date(...)`. Use the same logic the share-link util uses to keep behavior consistent.

## 3. Mobile polish

Tighten the small-screen experience without redesigning anything.

- `src/pages/Index.tsx`: switch the main grid gap from `gap-8` to `gap-4 lg:gap-8`, reduce card padding to `p-4 lg:p-6`, and make the header `py-4 lg:py-6`. The right-column card currently stacks under the form on mobile, which is fine; just give it a bit less vertical padding.
- `src/components/ScheduleForm.tsx`: wrap the Generate button in a sticky container on mobile only:
  ```
  <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-card/95 backdrop-blur border-t border-border lg:static lg:bg-transparent lg:border-0 lg:p-0 lg:mx-0">
    <Button type="submit" className="w-full">{t('form.generateButton')}</Button>
  </div>
  ```
  Add `pb-20 lg:pb-0` to the form so the sticky bar never covers the last field.
- Add `min-h-[44px]` to the weekday checkbox rows and to the recurrence ordinal pill buttons so taps are comfortable.
- `src/components/ScheduleDisplay.tsx`: make the action button row wrap (`flex-wrap`) and use `flex-1 sm:flex-none` on each so they stack neatly on narrow screens. (Read this file first before editing to confirm current button layout.)

## 4. Dark mode toggle

Wire up a header toggle using the existing tokens.

- Install `next-themes` (already common in shadcn projects) and wrap `App` in `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`.
- New component `src/components/ThemeToggle.tsx` with a sun/moon lucide icon button that flips between `light` and `dark`. Place it in the header next to `<LanguageToggle />`.
- `tailwind.config.ts`: confirm `darkMode: ["class"]` is set (shadcn default); if not, add it.
- `src/index.css`: verify `.dark` variables exist for `--background`, `--foreground`, `--card`, `--primary`, etc. If any are missing or thin, fill them with appropriate dark values mirrored from light. Avoid hardcoded colors anywhere; everything must read from tokens.
- The header gradient on the calendar icon (`from-primary to-accent`) already uses tokens so it carries over.
- One small fix needed: the icon block uses `text-white` (literal). Replace with `text-primary-foreground` so it stays correct in both themes.
- Persist choice via `next-themes` default (uses localStorage).
- New i18n keys: `theme.toggleLight`, `theme.toggleDark`, `theme.toggleSystem` (only used in aria-labels).

## Technical details

Files touched:
- `src/components/ScheduleForm.tsx` (inline errors, sticky button, tap targets)
- `src/components/ScheduleDisplay.tsx` (responsive action row)
- `src/components/ThemeToggle.tsx` (new)
- `src/components/RecentSchedules.tsx` (new)
- `src/utils/recentSchedules.ts` (new)
- `src/pages/Index.tsx` (history wiring, padding, ThemeToggle slot, fix text-white)
- `src/App.tsx` (ThemeProvider)
- `src/locales/en.json` and `src/locales/id.json` (recent.* and theme.* keys)
- `tailwind.config.ts` (only if darkMode key is missing)
- `src/index.css` (top up .dark tokens if thin)
- `package.json` (add `next-themes`)

No changes to:
- `scheduleGenerator.ts`, `shareLink.ts`, `googleCalendar.ts`, `copyFormats.ts`
- Zod schemas, share-link payload, export formats

## Out of scope (next time)

- Smart presets
- Live preview of upcoming sessions
- Better empty state with sample
- Keyboard shortcuts

Approve to implement.
