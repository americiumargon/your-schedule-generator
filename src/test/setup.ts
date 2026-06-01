import "@testing-library/jest-dom";

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
