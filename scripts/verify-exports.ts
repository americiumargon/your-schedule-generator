// Headless verification of CSV/ICS/PDF for Combined and Per-Track ZIP scopes.
// Run with: bun scripts/verify-exports.ts

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";

// ---- DOM shims ----------------------------------------------------------
type Captured = { filename: string; bytes: Uint8Array; type: string };
const captured: Captured[] = [];

(globalThis as any).window = globalThis;
(globalThis as any).navigator = { userAgent: "node" };
(globalThis as any).self = globalThis;

const blobMap = new Map<string, Blob>();
let counter = 0;

(globalThis as any).URL = {
  ...(globalThis as any).URL,
  createObjectURL(blob: Blob) {
    const url = `blob:fake/${++counter}`;
    blobMap.set(url, blob);
    return url;
  },
  revokeObjectURL(url: string) {
    blobMap.delete(url);
  },
};

const pendingClicks: Promise<void>[] = [];
(globalThis as any).document = {
  createElement(tag: string) {
    const a: any = {
      tagName: tag.toUpperCase(),
      style: {},
      setAttribute(_k: string, _v: string) {},
      href: "",
      download: "",
      rel: "",
      target: "",
      click() {
        const blob = blobMap.get(a.href);
        if (!blob) return;
        const p = blob.arrayBuffer().then((buf) => {
          captured.push({ filename: a.download || "unnamed", bytes: new Uint8Array(buf), type: blob.type });
        });
        pendingClicks.push(p);
      },
    };
    return a;
  },
  body: { appendChild() {}, removeChild() {} },
  head: { appendChild() {}, removeChild() {} },
  documentElement: { appendChild() {}, removeChild() {} },
};

// ---- Imports (after shims) ---------------------------------------------
const { generateProject } = await import("../src/utils/projectGenerator.ts");
const { exportToCSV, exportToICS } = await import("../src/utils/scheduleGenerator.ts");
const { exportToPDF } = await import("../src/utils/pdfExport.ts");
const { exportPerTrackZip } = await import("../src/utils/perTrackExport.ts");
const { createTrack } = await import("../src/utils/tracks.ts");

// ---- Test project -------------------------------------------------------
const startDate = new Date(2026, 0, 5); // Mon 2026-01-05
const endDate = new Date(2026, 1, 1); // 2026-02-01

const project = {
  projectName: "Spring Term",
  startDate,
  mode: "endDate" as const,
  endDate,
  holidays: [],
  holidayBehavior: "skip" as const,
  reminderMinutes: 0,
  timezone: "UTC",
  tracks: [
    createTrack({
      name: "Beginner",
      color: "#0ea5e9",
      selectedDays: [1, 3],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "weekly", interval: 1 },
    }, 0),
    createTrack({
      name: "Advanced",
      color: "#ef4444",
      selectedDays: [2, 4],
      timeSlots: [{ startTime: "18:00", endTime: "19:30" }],
      recurrence: { type: "weekly", interval: 1 },
    }, 1),
  ],
};

const { byTrack, combined } = generateProject(project as any);
console.log(`Generated: combined=${combined.length}, beginner=${byTrack[project.tracks[0].id].length}, advanced=${byTrack[project.tracks[1].id].length}`);

const branding = {
  accentColor: "#0ea5e9",
  orgName: "Test Academy",
  tagline: "",
  footer: "",
  logoDataUrl: "",
};
const t = (k: string) =>
  ({
    "pdf.location": "Location",
    "pdf.timezone": "Timezone",
    "pdf.sessions": "Sessions",
    "pdf.dateRange": "Date range",
    "pdf.page": "Page",
    "pdf.col.num": "#",
    "pdf.col.date": "Date",
    "pdf.col.day": "Day",
    "pdf.col.time": "Time",
    "pdf.col.location": "Location",
    "pdf.col.notes": "Notes",
    "pdf.col.track": "Track",
  } as Record<string, string>)[k] ?? k;

const opts = { reminderMinutes: 0, timezone: "UTC", includeTrackColumn: true };

const outDir = resolve("/tmp/export-verify");
mkdirSync(outDir, { recursive: true });

function take() {
  return captured.splice(0, captured.length);
}

// Combined exports
try { exportToCSV(combined as any, project.projectName, "en", opts); } catch (e) { console.error("CSV failed:", e); }
try { exportToICS(combined as any, project.projectName, "en", opts); } catch (e) { console.error("ICS failed:", e); }
try { exportToPDF(combined as any, project.projectName, "en", opts, branding as any, t); } catch (e) { console.error("PDF failed:", e); }
await Promise.all(pendingClicks.splice(0));
const combinedFiles = take();
console.log("Combined captured:", combinedFiles.map((f) => f.filename));

// Per-track ZIP
for (const fmt of ["csv", "ics", "pdf"] as const) {
  try { await exportPerTrackZip(byTrack as any, project.tracks as any, project.projectName, fmt, opts, branding as any, t, "en"); }
  catch (e) { console.error(`ZIP ${fmt} failed:`, e); }
}
await Promise.all(pendingClicks.splice(0));
const zipFiles = take();
console.log("ZIP captured:", zipFiles.map((f) => f.filename));

// ---- Persist + assert ---------------------------------------------------
const results: Record<string, string> = {};

for (const f of [...combinedFiles, ...zipFiles]) {
  const p = resolve(outDir, f.filename);
  writeFileSync(p, f.bytes);
  console.log(`wrote ${p} (${f.bytes.length} bytes, ${f.type})`);
}

function assert(name: string, cond: boolean, detail = "") {
  results[name] = cond ? "PASS" : `FAIL ${detail}`;
  console.log(`${cond ? "✓" : "✗"} ${name} ${detail}`);
}

// Combined CSV
const csvText = new TextDecoder().decode(combinedFiles.find((f) => f.filename.endsWith(".csv"))!.bytes);
assert("combined CSV has Class column", csvText.split("\n")[0].includes("Class"));
assert("combined CSV mentions Beginner", csvText.includes("Beginner"));
assert("combined CSV mentions Advanced", csvText.includes("Advanced"));
assert("combined CSV has Track: lines", csvText.includes("Track: Beginner") && csvText.includes("Track: Advanced"));
const csvRows = (csvText.match(/^"Spring Term - /gm) ?? []).length;
assert("combined CSV row count == combined sessions", csvRows === combined.length, `(${csvRows} vs ${combined.length})`);

// Combined ICS
const icsText = new TextDecoder().decode(combinedFiles.find((f) => f.filename.endsWith(".ics"))!.bytes);
const veventCount = (icsText.match(/BEGIN:VEVENT/g) ?? []).length;
assert("combined ICS VEVENT count", veventCount === combined.length, `(${veventCount} vs ${combined.length})`);
assert("combined ICS has [Beginner]", icsText.includes("[Beginner]"));
assert("combined ICS has [Advanced]", icsText.includes("[Advanced]"));
assert("combined ICS has Track: desc", icsText.includes("Track: Beginner") && icsText.includes("Track: Advanced"));

// Combined PDF (binary smoke)
const pdfBytes = combinedFiles.find((f) => f.filename.endsWith(".pdf"))!.bytes;
assert("combined PDF starts with %PDF", new TextDecoder().decode(pdfBytes.slice(0, 4)) === "%PDF");
assert("combined PDF non-trivial size", pdfBytes.length > 2000, `(${pdfBytes.length}b)`);

// ZIPs
for (const fmt of ["csv", "ics", "pdf"] as const) {
  const zipFile = zipFiles.find((f) => f.filename.endsWith(`-${fmt}.zip`));
  assert(`per-track ${fmt} zip emitted`, !!zipFile);
  if (!zipFile) continue;
  const zip = await JSZip.loadAsync(zipFile.bytes);
  const names = Object.keys(zip.files);
  assert(`per-track ${fmt} has 2 files`, names.length === 2, `(${names.join(", ")})`);
  const beg = names.find((n) => n.includes("Beginner"));
  const adv = names.find((n) => n.includes("Advanced"));
  assert(`per-track ${fmt} names contain track names`, !!beg && !!adv);
  if (beg && adv) {
    const begData = await zip.files[beg].async("uint8array");
    const advData = await zip.files[adv].async("uint8array");
    if (fmt !== "pdf") {
      const begText = new TextDecoder().decode(begData);
      const advText = new TextDecoder().decode(advData);
      assert(`per-track ${fmt} Beginner file has no Advanced leak`, !begText.includes("Advanced"));
      assert(`per-track ${fmt} Advanced file has no Beginner leak`, !advText.includes("Beginner"));
    } else {
      assert(`per-track pdf Beginner is PDF`, new TextDecoder().decode(begData.slice(0, 4)) === "%PDF");
      assert(`per-track pdf Advanced is PDF`, new TextDecoder().decode(advData.slice(0, 4)) === "%PDF");
    }
    writeFileSync(resolve(outDir, beg), begData);
    writeFileSync(resolve(outDir, adv), advData);
  }
}

console.log("\n=== Summary ===");
for (const [k, v] of Object.entries(results)) console.log(`${v.startsWith("PASS") ? "✓" : "✗"} ${k}: ${v}`);
const failed = Object.values(results).filter((v) => !v.startsWith("PASS")).length;
console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAIL`}`);
process.exit(failed === 0 ? 0 : 1);
