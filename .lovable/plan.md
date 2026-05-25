## Per-session editing

Let users click any generated session to adjust its date, start time, and end time individually — useful when a single session gets rescheduled without regenerating the whole list.

### UX

- Each session card in `ScheduleDisplay` gets an Edit (pencil) icon button on the right, next to the time text.
- Clicking it opens a Popover containing:
  - Date picker (shadcn Calendar in a popover, like the form)
  - Start time input (`type="time"`)
  - End time input (`type="time"`)
  - Save / Cancel buttons
- Saving updates that one session in place. The session list re-sorts by date so it stays chronological. Session numbers are reassigned 1..N after sorting so order stays consistent.
- A small "edited" badge appears on any session whose date/time differs from the originally generated values (subtle visual cue).
- Toast confirmation on save: "Session updated" (with undo to restore prior values, matching the existing Undo pattern).

### Technical changes

**`src/pages/Index.tsx`**
- Add `handleUpdateSession(index, { date, startTime, endTime })` that:
  - Replaces the session at that index, re-sorts the array by date+startTime, reassigns `sessionNumber`.
  - Shows a toast with Undo restoring the previous `sessions` array.
- Pass `onUpdateSession` to `ScheduleDisplay`.

**`src/components/ScheduleDisplay.tsx`**
- Extend `Session` type usage to track an optional `edited: boolean` flag (set by parent when an update happens). Alternative: keep a `Set<number>` of edited session indexes locally — simpler, no type change. Use the local Set approach.
- Add `EditSessionPopover` subcomponent (or inline Popover) rendered per card with a `Pencil` icon trigger.
- On save, call `onUpdateSession(index, ...)` and mark that session as edited.
- Keep checkbox + existing layout; place edit button between time text and (now) end of row.

**`src/locales/en.json` & `src/locales/id.json`** — add keys:
- `schedule.editSession`: "Edit session" / "Ubah sesi"
- `schedule.editedBadge`: "edited" / "diubah"
- `schedule.save`: "Save" / "Simpan"
- `schedule.cancel`: "Cancel" / "Batal"
- `toast.sessionUpdated`: "Session updated" / "Sesi diperbarui"

### Out of scope

- Adding/deleting individual sessions (only editing existing ones).
- Bulk edits or drag-to-reschedule.
