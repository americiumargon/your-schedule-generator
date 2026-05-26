
# Copy polish + weekday layout fix

Two things: (1) tighten the copy across the app with a neutral, clear voice (not chatty), and (2) restructure the weekday picker so column 1 = Mon to Thu and column 2 = Fri to Sun. No em dashes anywhere in the copy.

## 1. Weekday picker layout

Currently the grid is `grid-cols-2` which fills row by row (Mon/Tue, Wed/Thu, Fri/Sat, Sun). You want column-major:

```
Monday      Friday
Tuesday     Saturday
Wednesday   Sunday
Thursday
```

Change `src/components/ScheduleForm.tsx` (line 529):
- Replace `grid grid-cols-2 gap-2` with `grid grid-rows-4 grid-flow-col gap-x-6 gap-y-2` so items flow down then across, producing two columns of 4 + 3.

No data changes. The `WEEKDAYS` array order stays Mon to Sun.

## 2. Copywriting pass

Goal: neutral, concise, consistent. Remove "Please" filler, avoid em dashes (use periods, commas, or parentheses instead), keep a calm utilitarian tone.

### Header & shell

| Key | Before | After |
|---|---|---|
| `header.title` | Schedule Generator | Schedule Generator |
| `header.subtitle` | Generate a schedule of sessions for any activity | Create recurring schedules for classes, meetings, and events |
| `footer.text` | Perfect for personal routines, team schedules, and recurring events | For personal routines, team schedules, and recurring events |

### Form, main labels & placeholders

| Key | Before | After |
|---|---|---|
| `form.title` | Schedule Details | Schedule details |
| `form.eventName` | Activity Name | Activity name |
| `form.eventNamePlaceholder` | e.g., Morning Workout, Team Standup, Study Session | e.g. Morning workout, Team standup, Study session |
| `form.startDate` | Start Date | First session date |
| `form.generateBy` | Generate by | End the schedule |
| `form.modeByCount` | Number of sessions | After N sessions |
| `form.modeByEndDate` | End date | On a specific date |
| `form.numberOfMeetings` | Number of Sessions | Number of sessions |
| `form.meetingDays` | Recurring Days | Days of the week |
| `form.selectDays` | Select the days of the week for your sessions | Choose one or more days |
| `form.sections.time` | Session Time | Session time |
| `form.helper.time` | When does each session start and end? | Applies to every session unless you add more slots below |
| `form.generateButton` | Generate Schedule | Generate schedule |

### Form, advanced section

| Key | Before | After |
|---|---|---|
| `form.advanced.title` | Advanced options | More options |
| `form.advanced.customizedBadge` | {{count}} customized | {{count}} changed |
| `form.sections.repeat` | Repeat pattern | Repeat pattern |
| `form.helper.repeat` | Change how often sessions recur — every week, every few weeks, or specific dates of the month. | Set how often sessions recur. |
| `form.sections.slotsHolidays` | Time slots & holidays | Time slots and days off |
| `form.helper.slotsHolidays` | Add multiple sessions per day and exclude specific dates. | Add more sessions per day or exclude specific dates. |
| `form.sections.details` | Event details & calendar | Calendar details |
| `form.helper.details` | Add location, notes, a reminder, and pick a timezone for ICS exports. | Location, notes, reminder, and timezone (used for exports). |

### Form, time slots, holidays, recurrence helpers

| Key | Before | After |
|---|---|---|
| `form.timeSlots.title` | Time Slots | Time slots |
| `form.timeSlots.add` | Add slot | Add slot |
| `form.timeSlots.labelForFirst` | Name this session (optional) | Slot label (optional) |
| `form.timeSlots.description` | Each selected day generates one session per slot. | Each selected day creates one session per slot. |
| `form.holidays` | Holidays / Days Off | Days to skip |
| `form.holidaysDescription` | Select dates to exclude from the schedule | Dates that should never have a session |
| `form.selectHolidays` | Select holidays | Pick dates |
| `form.holidayBehavior.label` | When a session falls on a holiday | If a session lands on one of these dates |
| `form.holidayBehavior.skip` | Skip the session | Skip the session |
| `form.holidayBehavior.rollForward` | Move to the next available weekday | Move to the next available weekday |
| `form.holidayBehavior.description` | Roll-forward looks up to 14 days ahead for a matching weekday that isn't a holiday. | Looks up to 14 days ahead for a matching weekday that is not a day off. |
| `form.recurrence.daysOfMonthHint` | Days past the end of a shorter month are clamped (e.g. 31 → Feb 28). | Dates past the end of a shorter month use that month's last day (e.g. 31 becomes Feb 28). |
| `form.timezoneDescription` | Used for ICS exports. CSV uses your calendar's local time. | Used for ICS exports. CSV uses your calendar's local time. |
| `form.reminder` | Reminder (ICS only) | Reminder (ICS exports only) |

### Validation toasts

| Key | Before | After |
|---|---|---|
| `form.validation.eventNameRequired` | Please enter an activity name | Enter an activity name |
| `form.validation.dateRequired` | Please select a start date | Select a start date |
| `form.validation.meetingsRequired` | Number of sessions must be at least 1 | Number of sessions must be at least 1 |
| `form.validation.daysRequired` | Please select at least one day of the week | Select at least one day of the week |
| `form.validation.ordinalsRequired` | Please select at least one occurrence (e.g. 1st, 2nd) | Select at least one occurrence (e.g. 1st, 2nd) |
| `form.validation.daysOfMonthRequired` | Please select at least one day of the month | Select at least one day of the month |
| `form.validation.timeRequired` | Please enter both start and end times | Enter a start and end time for every slot |
| `form.validation.endDateRequired` | Please select an end date | Select an end date |
| `form.validation.noSessionsInRange` | No sessions fall within the selected range | No sessions fit in this date range |
| `form.validation.invalid` | Please check your input and try again | Check the form and try again |

### Schedule display & empty state

| Key | Before | After |
|---|---|---|
| `schedule.title` | Your Schedule | Schedule |
| `schedule.sessionsSelected` | {{count}} of {{total}} sessions selected | {{count}} of {{total}} sessions selected |
| `schedule.clearAll` | Clear All | Clear |
| `schedule.shareButton` | Share link | Copy share link |
| `schedule.googleButton` | Add to Google | Add to Google Calendar |
| `emptyState.title` | No Schedule Yet | No schedule yet |
| `emptyState.description` | Fill in the form and click "Generate Schedule" to create your event calendar | Fill in the form and click Generate schedule to see your sessions here. |

### Toasts

| Key | Before | After |
|---|---|---|
| `toast.generated` | Generated {{count}} sessions! | Generated {{count}} sessions |
| `toast.cleared` | Schedule cleared successfully | Schedule cleared |
| `toast.copied` | Schedule copied to clipboard | Copied to clipboard |
| `toast.linkCopied` | Link copied to clipboard | Share link copied |
| `toast.loadedFromLink` | Schedule loaded from link | Loaded from shared link |
| `toast.linkInvalid` | Shared link is invalid or outdated | Shared link is invalid or outdated |
| `toast.gcalTooMany` | Too many sessions for one Google Calendar link. Use ICS instead. | Too many sessions for one Google Calendar link. Use ICS instead. |
| `toast.gcalTimeConflicts` | Some sessions have different times — they'll use the first session's time. Use ICS for full fidelity. | Sessions have different times. Google Calendar will use the first session's time. Use ICS for full fidelity. |

### Indonesian translations

Mirror every key in `src/locales/id.json` with the same neutral tone. Drop "Silakan" where the English drops "Please", and avoid em dashes (use periods, commas, or parentheses).

## Technical details

Files changed:
- `src/components/ScheduleForm.tsx`: single line change for the weekday grid classes.
- `src/locales/en.json`: value updates only, no key additions or removals.
- `src/locales/id.json`: parallel value updates.

No logic, schema, share link, or export format changes.

## Out of scope

- Restructuring sections, presets, live preview, or wizard flow.
- Renaming i18n keys.

Approve to implement.
