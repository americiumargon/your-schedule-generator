# Automated CI test for PDF export

Port the ad-hoc PDF verification script into a proper Vitest test that runs in CI for both export scopes.

## What gets added

### 1. Vitest setup
- Add dev deps: `vitest`, `@vitest/coverage-v8` (optional), `jsdom`, `@types/node` (already present), `pypdf`-free — we'll parse PDFs in JS using `pdf-parse` or just inspect the raw `Uint8Array` for keywords (text streams in jsPDF are uncompressed enough to grep). To avoid extra deps, search the raw PDF bytes for required substrings.
- Create `vitest.config.ts` with `environment: "jsdom"` and `setupFiles: ["src/test/setup.ts"]`.
- Create `src/test/setup.ts` shimming `URL.createObjectURL` / `revokeObjectURL` and a fake `<a>` click so `jsPDF.save()` doesn't crash. Patch `jsPDF.API.save` to push the `arraybuffer` output into a module-level capture array (same trick used in the manual verification).
- Add npm scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

### 2. The test — `src/utils/__tests__/pdfExport.test.ts`
Fixture: 2 tracks (Beginner Mon/Wed 09:00–10:00, Advanced Tue/Thu 18:00–19:30), 4-week range, no holidays. Built via existing `scheduleGenerator` / `projectGenerator` helpers so the test exercises the real pipeline.

Cases:
1. **Combined PDF** — call `exportToPDF(sessions, "QA Term", t, { includeTrackColumn: true })`. Assert: 1 captured PDF, byte length > 1KB, raw bytes contain `"QA Term"`, `"Track"`, `"Beginner"`, `"Advanced"`, `"09:00"`, `"18:00"`.
2. **Per-track ZIP** — call `exportPerTrackZip(...)` with `formats: ["pdf"]`. Use `JSZip.loadAsync` on the captured Blob, assert entries `Beginner.pdf` and `Advanced.pdf` exist. For each, assert byte length > 1KB, own track name present, the other track name absent, no `"Track"` column header.

Shared `t()` resolver reads `src/locales/en.json` (dotted-key lookup, same as the manual script).

### 3. GitHub Actions workflow — `.github/workflows/test.yml`
- Triggers: `push` and `pull_request` on all branches.
- Steps: checkout → setup-node 20 → `npm ci` → `npm test`.
- No artifacts uploaded; failures surface via the test runner.

## Technical details

- Capture mechanism: monkey-patch `jsPDF.API.save` once in `setup.ts` so every `doc.save()` call inside `pdfExport.ts` / `perTrackExport.ts` pushes `{ name, buffer }` to a global `__pdfCaptures` array; tests clear and read it.
- For the ZIP case, monkey-patch `URL.createObjectURL` to retain the most recent `Blob` on a `globalThis.__lastBlob` reference, since `perTrackExport` builds a Blob and triggers a download via anchor click.
- Raw-byte assertions: decode the captured `ArrayBuffer` with `TextDecoder("latin1")` and run `includes()` checks. jsPDF writes table cell text uncompressed by default, so plain substring matches are reliable for ASCII content like track names, times, and column headers.
- No production code changes — purely additive test + workflow + config.

## Files touched
- `package.json` (devDeps + scripts)
- `vitest.config.ts` (new)
- `src/test/setup.ts` (new)
- `src/utils/__tests__/pdfExport.test.ts` (new)
- `.github/workflows/test.yml` (new)
