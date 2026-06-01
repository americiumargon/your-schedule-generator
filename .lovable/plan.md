## Goal
Let users save their in-progress form as a shareable link they can paste anywhere, then resume on another device by opening that link — even if the form was never generated.

## What works today
- Share links already exist (`buildShareUrl` / `decodeShareState` / `readShareTokenFromHash`).
- `Index.tsx` already reads `#s=…` on mount and pipes it into `ScheduleForm` via `initialState`.
- Today's flow only allows sharing **after** a successful Generate — the share button lives in `ScheduleDisplay`.

## Gap
1. No way to save/share form state *before* generation.
2. The share-link Zod schema requires fully-valid data (`pn.min(1)`, `ts.min(1)`, time format, recurrence shape, etc.). A half-filled form can't be encoded, and a half-filled link can't be decoded.

## Changes

### 1. `src/utils/shareLink.ts` — add v3 "draft" token
A new variant where every field is optional and validators are loose:

```ts
const v3Token = z.object({
  v: z.literal(3),
  pn: z.string().max(100).optional(),
  sd: dateStr.optional(),
  m: z.enum(["count", "endDate"]).optional(),
  c: z.number().int().min(1).max(366).optional(),
  ed: dateStr.optional(),
  h: z.array(dateStr).max(366).optional(),
  hb: z.enum(["skip", "rollForward"]).optional(),
  r: z.number().optional(),
  tz: z.string().max(100).optional(),
  tr: z.array(draftTrackSchema).max(12).optional(),
});
```

Where `draftTrackSchema` mirrors `trackSchema` but with `n`, `d`, `ts`, `rec` all optional and `ts` items allowing empty `s`/`e` strings.

Add a new exported type:
```ts
export type DraftFormState = Partial<ShareFormState> & { tracks?: Partial<Track>[] };
```

Export new functions:
- `encodeDraftState(state: DraftFormState): string` — emits a v3 token, omits empty/undefined fields, b64url-encodes.
- Extend `decodeShareState` to recognize v3 and return a `DraftFormState` (cast through to `ShareFormState` since `ScheduleForm`'s `initialState` already tolerates undefined fields in every initializer — verified line-by-line).

Existing v1/v2 paths stay untouched for back-compat.

### 2. `ScheduleForm.tsx` — expose current draft + add "Save draft" button
- Add an optional `onSaveDraft?: (draft: DraftFormState) => void` prop.
- Add a small **"Save draft"** button next to the existing **Generate schedule** button at the bottom of the form. Button is always enabled (the whole point is partial state).
- Builds the current draft object from local state:
  ```ts
  const buildDraft = (): DraftFormState => ({
    projectName: projectName || undefined,
    startDate, mode, numberOfMeetings: parseInt(numberOfMeetings) || undefined,
    endDate, holidays, holidayBehavior, reminderMinutes, timezone,
    tracks: drafts.map(draftToTrack), // drafts already mostly safe
  });
  ```
  Pass to `onSaveDraft`.

### 3. `Index.tsx` — wire it up
- Add `handleSaveDraft`:
  ```ts
  const handleSaveDraft = async (draft: DraftFormState) => {
    try {
      const token = encodeDraftState(draft);
      const { origin, pathname } = window.location;
      await navigator.clipboard.writeText(`${origin}${pathname}#s=${token}`);
      toast.success(t('toast.draftLinkCopied'));
    } catch {
      toast.error(t('toast.linkCopyFailed'));
    }
  };
  ```
- Pass `onSaveDraft={handleSaveDraft}` to `<ScheduleForm>`.
- The existing `decodeShareState` call in the mount effect already returns a usable shape (v3 returns partial); the toast message stays the same (`toast.loadedFromLink`).

### 4. i18n
Add to `en.json` and `id.json`:
- `form.saveDraft` — "Save draft" / "Simpan draf"
- `form.saveDraftHelper` — "Copy a link to continue later" / "Salin tautan untuk dilanjutkan nanti" (tooltip / sr text)
- `toast.draftLinkCopied` — "Draft link copied" / "Tautan draf disalin"

### 5. Tests
Extend `src/utils/__tests__/exportE2E.test.ts` or add `src/utils/__tests__/shareLink.test.ts`:
- Encode an empty draft → decode → returns empty `DraftFormState` (no throw).
- Encode partial draft (name only, no startDate) → decode round-trips name, leaves other fields undefined.
- v2 fully-valid token still decodes correctly (regression).

## Files touched
- `src/utils/shareLink.ts` (add v3 schema + `encodeDraftState`, extend `decodeShareState`)
- `src/components/ScheduleForm.tsx` (add `onSaveDraft` prop + button)
- `src/pages/Index.tsx` (add `handleSaveDraft`, pass prop)
- `src/locales/en.json`, `src/locales/id.json`
- new `src/utils/__tests__/shareLinkDraft.test.ts`

## Out of scope
- Silent auto-save to localStorage (the manual "Save draft" + share link already supports cross-device use).
- Multiple named drafts (Recents already covers post-generation; can revisit later).
- Sync via Lovable Cloud (still client-side per project memory).