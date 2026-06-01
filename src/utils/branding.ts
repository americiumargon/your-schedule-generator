export interface Branding {
  logoDataUrl?: string;
  orgName?: string;
  tagline?: string;
  accentColor?: string;
  footerText?: string;
}

const KEY = "branding:v1";

export function loadBranding(): Branding {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Branding;
  } catch {
    // ignore
  }
  return {};
}

export function saveBranding(b: Branding): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    // ignore
  }
}

export function clearBranding(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
