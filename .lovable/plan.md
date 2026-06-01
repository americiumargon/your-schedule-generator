## Goal
Add validation so a group cannot be its own predecessor and so circular "Start after group…" chains are blocked.

## Background
The "Start after group…" dropdown already hides the active group from itself (self-reference is filtered at the UI level), but there is no guard in the helper function and no detection of multi-group cycles (A→B→A, A→B→C→A, etc.).

## Changes

### 1. Data model – store the dependency link
Add an optional `startsAfter?: string` field (track ID of predecessor) to:
- `Track` interface in `src/utils/tracks.ts`
- `TrackDraft` interface in `src/components/ScheduleForm.tsx`

This field is set only when the helper button is used; cleared when the user manually picks a date.

### 2. Cycle-detection helper
Add a `wouldCreateCycle(activeId, sourceId, drafts)` function that walks `startsAfter` chains starting from `sourceId`. If it ever reaches `activeId`, a cycle would be created.

### 3. UI filtering
In the "Start after group…" dropdown (`ScheduleForm.tsx` lines 584-602):
- Keep the existing `d.id !== active.id` filter (self-reference).
- Add a second filter: exclude any group where `wouldCreateCycle(active.id, d.id, drafts)` is true.

Disabled/circular items can optionally be rendered as non-selectable with a "(would create cycle)" caption, or simply hidden.

### 4. Helper function guard
In `applyStartAfter`:
- If `sourceTrackId === active.id`, error (defense-in-depth).
- If `wouldCreateCycle(active.id, sourceTrackId, drafts)`, toast an error and abort.
- Only on success: set `startDate` **and** `startsAfter: sourceTrackId`.

### 5. Manual date picker behavior
When the user picks a date via the calendar popover for a group, also clear `startsAfter: undefined` so the group is no longer considered part of a dependency chain.

### 6. i18n
Add to `src/locales/en.json` and `src/locales/id.json`:
- `tracks.circularDependency` – e.g. "That would create a circular dependency."

### 7. Persistence (`src/utils/shareLink.ts`)
- Add `sa: z.string().min(1).max(64).optional()` to `trackSchema`.
- Encode: `...(t.startsAfter ? { sa: t.startsAfter } : {})`.
- Decode: map `tr.sa` to `startsAfter`.

### 8. Submit validation
In `handleSubmit`, after the existing per-track validation loop, run a full-project cycle check. If any track forms part of a cycle, add a per-track error and abort.

### 9. Tests
Extend `src/utils/__tests__/projectGenerator.test.ts` (or add a small standalone test) to verify:
- `wouldCreateCycle` correctly identifies A→B→A and A→B→C→A.
- Self-reference is rejected.

## Out of scope
- Auto-recomputing dates when a predecessor changes (dates remain fixed; the link is for validation only).
- Visual dependency graph or arrows between tabs.