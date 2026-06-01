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

// jsPDF copies every method defined on jsPDF.API onto each instance at
// construction time. Defining API.save here means new jsPDF() instances
// created by the production code will use our capturing save().
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(jsPDF as any).API.save = function (this: jsPDF) {
  const ab = this.output("arraybuffer") as ArrayBuffer;
  globalThis.__capturedBlobs.push(new Blob([ab], { type: "application/pdf" }));
  return this;
};

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
