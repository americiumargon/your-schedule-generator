## Shareable link

Encode the form state into the URL hash so any link a user copies can recreate the exact schedule input for someone else — no backend, no account.

### Source of truth

The **form inputs** are shared, not the generated sessions. Re-running the generator on the recipient's machine produces identical sessions (deterministic) and the recipient can also tweak before re-generating. Per-session edits and the `enabledSessions` selection are deliberately out of scope (they balloon the URL and lose meaning when the recipient regenerates).

### Encoding (`src/utils/shareLink.ts` — new file)

Compact JSON shape (short keys to keep URLs short):

```
{
  v: 1,                  // schema version
  n: string,             // event name
  sd: "YYYY-MM-DD",      // start date
  m: "count" | "endDate",
  c?: number,            // count (when m=count)
  ed?: "YYYY-MM-DD",     // end date (when m=endDate)
  d: number[],           // selected weekday ids (0-6)
  st: "HH:MM",
  et: "HH:MM",
  h: "YYYY-MM-DD"[],     // holidays
  l?: string,            // location
  nt?: string,           // notes
  r: number,             // reminder minutes
  tz: string             // timezone
}
```

Exports:
- `encodeShareState(state): string` — JSON.stringify → UTF-8 → base64url (no padding, URL-safe alphabet via `btoa` + `+/=` → `-_` strip).
- `decodeShareState(token): ShareState | null` — reverse, with Zod validation (`shareStateSchema`); returns `null` and logs on any failure so a bad link never crashes the app.
- Date strings parsed back into `Date` objects on decode.

URL hash chosen over query string (`?s=...`) because hash never hits any server, larger payload tolerance, and doesn't get logged by analytics.

URL shape: `https://app.example.com/#s=<token>`

### Reading on load (`src/pages/Index.tsx`)

On mount, check `window.location.hash`. If it starts with `#s=`, decode and:
1. Pass the decoded state to `ScheduleForm` as an optional `initialState` prop.
2. Show a small toast: "Schedule loaded from link" (with `toast.loadedFromLink` key).
3. Strip the hash from the URL (`history.replaceState`) so a later share/print isn't polluted.

If decode fails, show `toast.linkInvalid` and ignore.

### Form prefill (`src/components/ScheduleForm.tsx`)

- New optional prop `initialState?: ShareState`.
- All `useState` initializers read from `initialState` when present, otherwise their current defaults. Done via lazy initializers so it's a one-shot hydration, not a controlled override (lets the user edit freely after).
- No new submit logic — same validation runs.

### Share button (`src/components/ScheduleDisplay.tsx`)

Add a new **Share link** button next to Copy / CSV / ICS / Print, using the `Link2` icon. It:
1. Calls a new prop `onShare()` provided by `Index.tsx`.
2. `onShare` builds the token from the last-submitted form state (kept in `Index.tsx` alongside `sessions`), builds the URL, writes to clipboard via `navigator.clipboard.writeText`, and toasts `toast.linkCopied`.
3. Fallback toast `toast.linkCopyFailed` on clipboard error.

For this to work, `Index.tsx` must keep a reference to the **submitted** form state (not just the generated sessions). Add a `lastFormState` state set inside `onGenerate`.

### i18n (`src/locales/en.json` & `id.json`)

Add under `schedule`:
- `shareButton` — "Share link" / "Bagikan tautan"

Add under `toast`:
- `linkCopied` — "Link copied to clipboard" / "Tautan disalin ke clipboard"
- `linkCopyFailed` — "Failed to copy link" / "Gagal menyalin tautan"
- `loadedFromLink` — "Schedule loaded from link" / "Jadwal dimuat dari tautan"
- `linkInvalid` — "Shared link is invalid or outdated" / "Tautan tidak valid atau kedaluwarsa"

### Versioning

`v: 1` on every token. `decodeShareState` rejects unknown versions, so future schema changes can ship without breaking existing links (we'd add migration paths if needed).

### URL size

Worst case ~500 chars (long event name + 50 holidays + long notes). Well under browser/social-platform limits (~2000+).

### Out of scope

- Per-session edits or `enabledSessions` selection in the link.
- Short-link / URL shortener (would need backend).
- QR code generation (easy follow-up; not part of this task).
- Encryption / private links.
