// Headless verification of PDF export (combined + per-track ZIP).
// Run with: bun scripts/verify-pdf-export.ts

import { writeFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

// ---- DOM shims for jsPDF + anchor.click capture ----
type Captured = { filename: string; bytes: Uint8Array };
const captured: Captured[] = [];

const blobToBytes = async (b: Blob): Promise<Uint8Array> =>
  new Uint8Array(await b.arrayBuffer());

const fakeAnchor = () => {
  const a: any = {
    href: "",
    download: "",
    style: {},
    setAttribute() {},
    click() {
      // resolve blob from URL map
      const url: string = a.href;
      const blob = blobMap.get(url);
      if (!blob) {
        console.warn("click without blob:", url);
        return;
      }
      blobToBytes(blob).then((bytes) => {
        captured.push({ filename: a.download, bytes });
      });
    },
  };
  return a;
};

const blobMap = new Map<string, Blob>();
let urlSeq = 0;

(globalThis as any).document = {
  createElement(tag: string) {
    if (tag === "a") return fakeAnchor();
    return { style: {}, setAttribute() {}, appendChild() {}, removeChild() {} };
  },
  body: {
    appendChild() {},
    removeChild() {},
  },
};
(globalThis as any).URL = (globalThis as any).URL ?? {};
(globalThis as any).URL.createObjectURL = (b: Blob) => {
  const url = `blob:fake/${++urlSeq}`;
  blobMap.set(url, b);
  return url;
};
(globalThis as any).URL.revokeObjectURL = (url: string) => {
  blobMap.delete(url);
};

// ---- Imports from app ----
const { generateProject } = await import("../src/utils/projectGenerator");
const { exportToPDF } = await import("../src/utils/pdfExport");
const { exportPerTrackZip } = await import("../src/utils/perTrackExport");
const en = (await import("../src/locales/en.json")).default as any;
const { newTrackId } = await import("../src/utils/tracks");
const jsPDFmod: any = (await import("jspdf")).default;

// Patch jsPDF.save to capture bytes directly
jsPDFmod.API.save = function (filename: string) {
  const ab = this.output("arraybuffer");
  captured.push({ filename, bytes: new Uint8Array(ab) });
  return this;
};

// ---- t() resolver from en.json ----
const t = (key: string, opts?: Record<string, unknown>) => {
  const parts = key.split(".");
  let cur: any = en;
  for (const p of parts) cur = cur?.[p];
  let s = typeof cur === "string" ? cur : key;
  if (opts) {
    for (const [k, v] of Object.entries(opts)) {
      s = s.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), String(v));
    }
  }
  return s;
};

// ---- Build project: two tracks, 4 weeks ----
const startDate = new Date(2026, 5, 1); // June 1, 2026 (Mon)
const endDate = new Date(2026, 5, 28); // June 28, 2026 (Sun)

const beginnerId = newTrackId();
const advancedId = newTrackId();

const project = {
  projectName: "QA Term",
  startDate,
  mode: "endDate" as const,
  endDate,
  holidays: [],
  holidayBehavior: "skip" as const,
  reminderMinutes: 0,
  timezone: "UTC",
  tracks: [
    {
      id: beginnerId,
      name: "Beginner",
      color: "#22c55e",
      selectedDays: [1, 3], // Mon, Wed
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      recurrence: { type: "weekly" as const, interval: 1 },
    },
    {
      id: advancedId,
      name: "Advanced",
      color: "#ef4444",
      selectedDays: [2, 4], // Tue, Thu
      timeSlots: [{ startTime: "18:00", endTime: "19:30" }],
      recurrence: { type: "weekly" as const, interval: 1 },
    },
  ],
};

const result = generateProject(project);
console.log(
  `Generated: combined=${result.combined.length}, beginner=${result.byTrack[beginnerId].length}, advanced=${result.byTrack[advancedId].length}`,
);

const branding = {
  orgName: "QA Org",
  tagline: "",
  accentColor: "#0ea5e9",
  footerText: "",
  logoDataUrl: "",
};

const opts = { reminderMinutes: 0, timezone: "UTC", includeTrackColumn: true };

// Case 1: combined PDF
exportToPDF(result.combined, project.projectName, "en", opts, branding as any, t);

// Case 2: per-track ZIP
await exportPerTrackZip(
  result.byTrack,
  project.tracks,
  project.projectName,
  "pdf",
  opts,
  branding as any,
  t,
  "en",
);

// Wait a tick for blob->bytes promises
await new Promise((r) => setTimeout(r, 250));

const outDir = "/tmp/qa";
for (const f of captured) {
  if (f.filename.endsWith(".pdf")) {
    writeFileSync(resolvePath(outDir, f.filename), f.bytes);
    console.log(`wrote ${f.filename} (${f.bytes.length} bytes)`);
  } else if (f.filename.endsWith(".zip")) {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(f.bytes);
    for (const [name, entry] of Object.entries(zip.files)) {
      if (name.endsWith(".pdf")) {
        const buf = await (entry as any).async("uint8array");
        writeFileSync(resolvePath(outDir, name), buf);
        console.log(`wrote ${name} (${buf.length} bytes) [from zip]`);
      }
    }
  }
}

console.log("DONE");
