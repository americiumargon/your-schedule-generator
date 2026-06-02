## Goals

1. Lock down per-group session counts with a regression test.
2. Ensure invalid per-track counts can never reach the generator.
3. Prove share links faithfully round-trip mixed per-group counts.

## 1. Regression test — group isolation

`src/utils/__tests__/projectGenerator.test.ts`, new `describe("per-group session count isolation")`:

- Build a project with three tracks (counts 3 / 6 / 9). Generate.
- Mutate only track A's `numberOfMeetings` to 12 and regenerate.
- Assert: A has 12 sessions, B still 6, C still 9.
- Also assert reference equality: the original `byTrack[B.id]` / `[C.id]` arrays from run #1 have identical length and date sequence as run #2 (no cross-contamination through shared references or holiday/recurrence state).

## 2. Per-track count validation

Validator (`validateMeetings`) is already strict (empty, non-numeric, decimals, out-of-range, NaN/Infinity all rejected) — reuse it, no schema change.

Form (`src/components/ScheduleForm.tsx`):
- Already runs `validateMeetings(d.numberOfMeetings)` per track in count mode on submit. Confirm and keep.
- Add defense-in-depth in `draftToTrack`: only set `numberOfMeetings` when `validateMeetings(d.numberOfMeetings) === null`; otherwise leave undefined so the generator falls back / produces zero sessions and the submit-time validator (which has already blocked submit) is the single source of truth.
- Add `inputMode="numeric"` and `pattern="[0-9]*"` on the per-track count Input to discourage non-numeric entry on mobile keyboards.

New focused tests in `src/utils/__tests__/validationEdgeCases.test.ts` under a new `describe("per-track meetings validation")`:
- "", "   ", "0", "367", "1.5", "-3", "1e2", "abc", "NaN" → each returns the expected ValidationCode.
- "1", "366", "  42  " → null.

## 3. Share link per-group counts

Existing v2 encoder/decoder already carry `nm` per track plus the legacy `c` fallback. Add coverage in `src/utils/__tests__/shareLinkDraft.test.ts`:

- Three-track mix: counts [4, 11, 33] + project-level `c=undefined`. Encode → decode → each track's `numberOfMeetings` matches exactly and other fields (name, color, days, slots, recurrence) survive.
- Mixed presence: track A has `numberOfMeetings=5`, track B has none, project-level `c=12`. After decode: A=5, B=12 (legacy fallback). 
- Boundary values: counts [1, 366] round-trip cleanly.
- Negative case: a v2 token with `mode="count"` AND no `c` AND no `nm` on any track decodes to `null` (existing relaxed decoder check).
- Draft (v3) round-trip: tracks `[{nm: 2}, {nm: 8}]` come back identical.

## Out of scope

- No UI redesign or new copy.
- No changes to ICS/CSV/PDF export pipelines.
- End-date mode unchanged.
