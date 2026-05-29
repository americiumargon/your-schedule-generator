import { useEffect } from "react";

export interface ShortcutDefinition {
  key: string; // e.g. "Enter", "k", "Escape" (case-insensitive for letters)
  mod?: boolean; // requires Cmd (mac) or Ctrl (others)
  handler: (e: KeyboardEvent) => void;
  // If true, fires even when typing in inputs/textareas/contenteditable. Default: false for non-mod, true for mod.
  allowInInputs?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const p = (navigator.platform || "").toLowerCase();
  const ua = (navigator.userAgent || "").toLowerCase();
  return p.includes("mac") || ua.includes("mac");
}

export function modKeyLabel(): string {
  return isMacPlatform() ? "⌘" : "Ctrl";
}

export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const s of shortcuts) {
        const wantMod = !!s.mod;
        const hasMod = isMacPlatform() ? e.metaKey : e.ctrlKey;
        if (wantMod !== hasMod) continue;
        const keyMatches = e.key.toLowerCase() === s.key.toLowerCase();
        if (!keyMatches) continue;
        const allowInInputs = s.allowInInputs ?? wantMod;
        if (!allowInInputs && isEditableTarget(e.target)) continue;
        e.preventDefault();
        s.handler(e);
        return;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
