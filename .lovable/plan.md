## Goal
Make light mode the default theme and switch the brand color from purple to forest green.

## Changes

### 1. Light mode as default (`src/App.tsx`)
Change `defaultTheme="system"` to `defaultTheme="light"` on the `ThemeProvider`. This forces the app to open in light mode on first visit regardless of OS preference.

### 2. Re-theme to forest green (`src/index.css`)
Update the semantic color tokens that drive the brand.

Current purple tokens:
- `--primary`: 243 75% 59%
- `--accent`: 267 84% 65%
- `--ring`: 243 75% 59%
- `--gradient-primary`: linear-gradient(135deg, hsl(243 75% 59%), hsl(267 84% 65%))

New forest green tokens:
- `--primary`: 142 72% 29% (forest green)
- `--accent`: 158 60% 42% (slightly brighter green for contrast)
- `--ring`: 142 72% 29%
- `--gradient-primary`: linear-gradient(135deg, hsl(142 72% 29%), hsl(158 60% 42%))

Apply to both `:root` (light) and `.dark` sections so the palette works in both themes.

## Out of scope
- No component file changes needed. All brand surfaces use the semantic tokens (`bg-primary`, `text-primary`, `from-primary to-accent`, etc.), so updating the CSS variables updates the entire app automatically.
- Theme toggle behavior stays the same.

## Files changed
- `src/App.tsx`
- `src/index.css`