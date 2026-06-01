// Test environment setup for Vitest (jsdom)
import jsPDF from "jspdf";

declare global {
  // eslint-disable-next-line no-var
  var __capturedBlobs: Blob[];
}

globalThis.__capturedBlobs = [];

const originalCreate = URL.createObjectURL?.bind(URL);
URL.createObjectURL = ((blob: Blob) => {
  globalThis.__capturedBlobs.push(blob);
  // Return a stable fake URL; jsdom's default may not exist.
  try {
    return originalCreate ? originalCreate(blob) : `blob:fake/${globalThis.__capturedBlobs.length}`;
  } catch {
    return `blob:fake/${globalThis.__capturedBlobs.length}`;
  }
}) as typeof URL.createObjectURL;

URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL;

// Wrap jsPDF so every instance has its `save` method replaced with a capture
// that pushes the PDF bytes as a Blob into globalThis.__capturedBlobs.
// jsPDF copies API methods onto each instance at construction time, so we
// patch instances rather than the prototype.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsPDFMod = jsPDF as any;
const OriginalJsPDF = jsPDFMod;
function PatchedJsPDF(this: unknown, ...args: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inst: any = new (OriginalJsPDF as any)(...args);
  inst.save = function () {
    const ab = inst.output("arraybuffer") as ArrayBuffer;
    globalThis.__capturedBlobs.push(new Blob([ab], { type: "application/pdf" }));
    return inst;
  };
  return inst;
}
PatchedJsPDF.prototype = OriginalJsPDF.prototype;
// Copy static members (API, version, etc.) so consumers keep working.
Object.setPrototypeOf(PatchedJsPDF, OriginalJsPDF);
for (const k of Object.getOwnPropertyNames(OriginalJsPDF)) {
  if (!(k in PatchedJsPDF)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (PatchedJsPDF as any)[k] = (OriginalJsPDF as any)[k];
    } catch {
      // ignore non-writable
    }
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(jsPDFMod as any).default = PatchedJsPDF;
// Replace the named export reference used by ESM consumers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modAny = jsPDFMod as any;
if (modAny.jsPDF) modAny.jsPDF = PatchedJsPDF;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Suppress anchor navigation side-effects from jsPDF.save() / zip download.
const origCreateElement = document.createElement.bind(document);
document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
  const el = origCreateElement(tagName, options);
  if (tagName.toLowerCase() === "a") {
    (el as HTMLAnchorElement).click = () => {};
  }
  return el;
}) as typeof document.createElement;
