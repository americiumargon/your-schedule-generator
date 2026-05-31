import { format } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import type { TFunction } from "i18next";

export interface CopySession {
  date: Date;
  sessionNumber: number;
  startTime: string;
  endTime: string;
  slotLabel?: string;
  location?: string;
  notes?: string;
}

export type CopyFormat = "plain" | "markdown" | "rich";

function getLocale(language: string) {
  return language === "id" ? idLocale : enUS;
}

function effLocation(s: CopySession, base?: string) {
  return s.location ?? base ?? "";
}
function effNotes(s: CopySession, base?: string) {
  return s.notes ?? base ?? "";
}
function anyLocationOverride(sessions: CopySession[]) {
  return sessions.some((s) => s.location !== undefined);
}
function anyNotesOverride(sessions: CopySession[]) {
  return sessions.some((s) => s.notes !== undefined);
}

export function formatPlain(
  eventName: string,
  sessions: CopySession[],
  location: string | undefined,
  notes: string | undefined,
  t: TFunction,
  language: string,
): string {
  const locale = getLocale(language);
  const blocks = sessions.map((s) => {
    const title = s.slotLabel
      ? `${eventName} - ${t("schedule.session")} ${s.sessionNumber} (${s.slotLabel})`
      : `${eventName} - ${t("schedule.session")} ${s.sessionNumber}`;
    const loc = effLocation(s, location);
    const nts = effNotes(s, notes);
    const base = `${title}: ${format(s.date, "EEEE, MMMM d, yyyy", { locale })}, ${s.startTime} - ${s.endTime}`;
    const head = loc ? `${base} @ ${loc}` : base;
    // Per-session notes appear inline when overridden
    return s.notes !== undefined && nts
      ? `${head}\n  ${nts.split("\n").join("\n  ")}`
      : head;
  });
  // Global notes once at the end (only if no per-session override and global notes exist)
  return notes && !anyNotesOverride(sessions)
    ? `${blocks.join("\n")}\n\n${notes}`
    : blocks.join("\n");
}

export function formatMarkdown(
  eventName: string,
  sessions: CopySession[],
  location: string | undefined,
  notes: string | undefined,
  t: TFunction,
  language: string,
): string {
  const locale = getLocale(language);
  const parts: string[] = [];
  parts.push(`# ${eventName}`);
  if (location && !anyLocationOverride(sessions)) parts.push(`📍 ${location}`);

  const showLocationCol = anyLocationOverride(sessions) || !!location;
  const header = showLocationCol
    ? `| ${t("schedule.colNumber")} | ${t("schedule.colDate")} | ${t("schedule.colTime")} | ${t("form.location").replace(/\s*\(.*\)$/, "")} |`
    : `| ${t("schedule.colNumber")} | ${t("schedule.colDate")} | ${t("schedule.colTime")} |`;
  const sep = showLocationCol ? `|---|------|------|------|` : `|---|------|------|`;
  const rows = sessions.map((s) => {
    const cells = [
      `${s.sessionNumber}${s.slotLabel ? ` (${s.slotLabel})` : ""}`,
      format(s.date, "EEE, MMM d, yyyy", { locale }),
      `${s.startTime} – ${s.endTime}`,
    ];
    if (showLocationCol) cells.push(effLocation(s, location) || "—");
    return `| ${cells.join(" | ")} |`;
  });
  parts.push([header, sep, ...rows].join("\n"));

  // Per-session note overrides listed under the table
  const overrideNotes = sessions
    .filter((s) => s.notes !== undefined && s.notes)
    .map((s) => `> **${t("schedule.session")} ${s.sessionNumber}:** ${s.notes!.replace(/\n/g, " ")}`);
  if (overrideNotes.length) parts.push(overrideNotes.join("\n"));

  if (notes && !anyNotesOverride(sessions)) {
    const quoted = notes.split("\n").map((l) => `> ${l}`).join("\n");
    parts.push(quoted);
  }
  return parts.join("\n\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatHtml(
  eventName: string,
  sessions: CopySession[],
  location: string | undefined,
  notes: string | undefined,
  t: TFunction,
  language: string,
): string {
  const locale = getLocale(language);
  const showLocationCol = anyLocationOverride(sessions) || !!location;

  const rows = sessions
    .map((s) => {
      const cells = [
        `${s.sessionNumber}${s.slotLabel ? ` <small>(${escapeHtml(s.slotLabel)})</small>` : ""}`,
        escapeHtml(format(s.date, "EEE, MMM d, yyyy", { locale })),
        `${s.startTime} – ${s.endTime}`,
      ];
      if (showLocationCol) cells.push(escapeHtml(effLocation(s, location) || "—"));
      return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    })
    .join("");

  const locationHtml =
    location && !anyLocationOverride(sessions) ? `<p>📍 ${escapeHtml(location)}</p>` : "";
  const headerCells = [t("schedule.colNumber"), t("schedule.colDate"), t("schedule.colTime")];
  if (showLocationCol) headerCells.push(t("form.location").replace(/\s*\(.*\)$/, ""));

  const overrideNotes = sessions
    .filter((s) => s.notes !== undefined && s.notes)
    .map(
      (s) =>
        `<p><strong>${escapeHtml(t("schedule.session"))} ${s.sessionNumber}:</strong> ${escapeHtml(
          s.notes!,
        ).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");

  const notesHtml = notes && !anyNotesOverride(sessions)
    ? `<blockquote>${escapeHtml(notes).replace(/\n/g, "<br>")}</blockquote>`
    : "";

  return `<h1>${escapeHtml(eventName)}</h1>${locationHtml}<table border="1" cellpadding="6" cellspacing="0"><thead><tr>${headerCells
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join("")}</tr></thead><tbody>${rows}</tbody></table>${overrideNotes}${notesHtml}`;
}

export async function writeToClipboard(
  format: CopyFormat,
  plain: string,
  html?: string,
): Promise<void> {
  if (format === "rich" && html && typeof ClipboardItem !== "undefined") {
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return;
    } catch {
      // fall through to text fallback
    }
  }
  await navigator.clipboard.writeText(plain);
}
