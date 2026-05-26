import { format } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import type { TFunction } from "i18next";

export interface CopySession {
  date: Date;
  sessionNumber: number;
  startTime: string;
  endTime: string;
  slotLabel?: string;
}

export type CopyFormat = "plain" | "markdown" | "rich";

function getLocale(language: string) {
  return language === "id" ? idLocale : enUS;
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
  const lines = sessions.map((s) => {
    const title = s.slotLabel
      ? `${eventName} - ${t("schedule.session")} ${s.sessionNumber} (${s.slotLabel})`
      : `${eventName} - ${t("schedule.session")} ${s.sessionNumber}`;
    const base = `${title}: ${format(s.date, "EEEE, MMMM d, yyyy", { locale })}, ${s.startTime} - ${s.endTime}`;
    return location ? `${base} @ ${location}` : base;
  });
  return notes ? `${lines.join("\n")}\n\n${notes}` : lines.join("\n");
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
  if (location) parts.push(`📍 ${location}`);

  const header = `| ${t("schedule.colNumber")} | ${t("schedule.colDate")} | ${t("schedule.colTime")} |`;
  const sep = `|---|------|------|`;
  const rows = sessions.map(
    (s) =>
      `| ${s.sessionNumber}${s.slotLabel ? ` (${s.slotLabel})` : ""} | ${format(s.date, "EEE, MMM d, yyyy", { locale })} | ${s.startTime} – ${s.endTime} |`,
  );
  parts.push([header, sep, ...rows].join("\n"));

  if (notes) {
    const quoted = notes
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n");
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
  const rows = sessions
    .map(
      (s) =>
        `<tr><td>${s.sessionNumber}${s.slotLabel ? ` <small>(${escapeHtml(s.slotLabel)})</small>` : ""}</td><td>${escapeHtml(
          format(s.date, "EEE, MMM d, yyyy", { locale }),
        )}</td><td>${s.startTime} – ${s.endTime}</td></tr>`,
    )
    .join("");

  const locationHtml = location ? `<p>📍 ${escapeHtml(location)}</p>` : "";
  const notesHtml = notes
    ? `<blockquote>${escapeHtml(notes).replace(/\n/g, "<br>")}</blockquote>`
    : "";

  return `<h1>${escapeHtml(eventName)}</h1>${locationHtml}<table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>${t(
    "schedule.colNumber",
  )}</th><th>${t("schedule.colDate")}</th><th>${t(
    "schedule.colTime",
  )}</th></tr></thead><tbody>${rows}</tbody></table>${notesHtml}`;
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
