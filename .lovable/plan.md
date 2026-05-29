## Keyboard shortcuts for power users

Add three global keyboard shortcuts with platform-aware visual hints.

### Shortcuts

| Shortcut | Action | Scope |
|---|---|---|
| `Cmd/Ctrl + Enter` | Submit the form and generate schedule | `ScheduleForm` |
| `Cmd/Ctrl + K` | Focus the "Activity name" input | `ScheduleForm` |
| `Esc` | Clear the generated schedule | `Index` (only when no text field is focused) |

### Implementation

1. **`src/hooks/useKeyboardShortcuts.ts` (new)**
   - Small hook that attaches a `document` `keydown` listener.
   - Accepts a record of shortcut keys → callbacks.
   - Normalises `Cmd` (macOS `metaKey`) and `Ctrl` (Windows/Linux `ctrlKey`) into a single `mod` modifier.
   - Calls `e.preventDefault()` on matched shortcuts.
   - Cleans up listener on unmount.

2. **`src/components/ScheduleForm.tsx`**
   - Add a `useRef` for the `eventName` `<Input>`.
   - Use `useKeyboardShortcuts` inside the component:
     - `mod+Enter` → programatically submit the form (call `handleSubmit` with a synthetic event or the existing submit flow).
     - `mod+k` → `eventNameRef.current?.focus()`.
   - Add a subtle `kbd` badge next to the generate button label showing `⌘+Enter` (macOS) or `Ctrl+Enter` (others).
   - Add a subtle `kbd` badge next to the "Activity name" label showing `⌘+K` / `Ctrl+K`.
   - Platform detection helper: `navigator.platform.toLowerCase().includes('mac')`.

3. **`src/pages/Index.tsx`**
   - Use `useKeyboardShortcuts`:
     - `Escape` → call `handleClear()`, **but only if**:
       - `sessions.length > 0`
       - The active element is **not** an `<input>`, `<textarea>`, `<select>`, or `[contenteditable]` (so typing users aren't surprised; first Esc blurs the field natively, second Esc clears).
       - No Radix popover or dialog is open (detected by checking for `[data-radix-popper-content-wrapper]` or `[role="dialog"]` in the DOM).

4. **`src/locales/en.json` & `src/locales/id.json`**
   - Add i18n keys under a new `shortcuts` namespace for the badge labels and any toast messages.
   - English examples:
     - `shortcuts.generate` → `⌘+Enter`
     - `shortcuts.focusName` → `⌘+K`
     - `shortcuts.modKey` → `⌘` / `Ctrl` (for platform-aware rendering)

### UI changes

- Generate button becomes: `Generate schedule  ⌘+Enter` (right-aligned, small `kbd`-styled text inside the button, muted).
- Activity name label becomes: `Activity name  ⌘+K` (small muted `kbd` text next to the label).
- Both badges use `text-xs text-muted-foreground font-mono bg-muted px-1 rounded` styling and are hidden on small screens (`hidden sm:inline`).

### Out of scope

- No new dependencies needed.
- No changes to schedule generation logic or exports.
- Theme/colors remain unchanged.