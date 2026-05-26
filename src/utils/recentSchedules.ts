import { encodeShareState, decodeShareState, type ShareFormState } from "./shareLink";

const STORAGE_KEY = "schedule-generator:recent";
const MAX_ENTRIES = 5;

export interface RecentScheduleEntry {
  id: string;
  name: string;
  createdAt: number;
  formState: ShareFormState;
}

interface StoredEntry {
  id: string;
  name: string;
  createdAt: number;
  token: string;
}

function readRaw(): StoredEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) => e && typeof e.id === "string" && typeof e.token === "string"
    );
  } catch {
    return [];
  }
}

function writeRaw(entries: StoredEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore quota errors
  }
}

export function loadRecent(): RecentScheduleEntry[] {
  const raw = readRaw();
  const out: RecentScheduleEntry[] = [];
  for (const entry of raw) {
    const formState = decodeShareState(entry.token);
    if (formState) {
      out.push({
        id: entry.id,
        name: entry.name,
        createdAt: entry.createdAt,
        formState,
      });
    }
  }
  return out;
}

export function saveRecent(name: string, formState: ShareFormState): void {
  const raw = readRaw();
  const token = encodeShareState(formState);
  const newEntry: StoredEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name || "Untitled",
    createdAt: Date.now(),
    token,
  };
  // De-duplicate identical tokens (regenerating same schedule)
  const filtered = raw.filter((e) => e.token !== token);
  const next = [newEntry, ...filtered].slice(0, MAX_ENTRIES);
  writeRaw(next);
}

export function removeRecent(id: string): void {
  writeRaw(readRaw().filter((e) => e.id !== id));
}

export function clearRecent(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
