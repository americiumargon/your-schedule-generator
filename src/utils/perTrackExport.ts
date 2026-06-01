import JSZip from "jszip";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import en from "@/locales/en.json";
import id from "@/locales/id.json";
import type { Branding } from "./branding";
import type { Track } from "./tracks";
import type { Session, ExportOptions } from "./scheduleGenerator";

type T = (key: string, opts?: Record<string, unknown>) => string;

function sanitize(s: string): string {
  return (s || "schedule").replace(/[^\w\-]+/g, "_").slice(0, 80) || "schedule";
}

function convertTo12Hour(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function buildCsv(sessions: Session[], eventName: string, language: string, opts: ExportOptions): string {
  const tr = language === 'id' ? id : en;
  const headers = ["Subject", "Start Date", "Start Time", "End Date", "End Time", "All Day Event", "Description", "Location", "Private"];
  const baseLocation = opts.location ?? "";
  const baseNotes = opts.notes ?? "";
  const rows = sessions.map((s) => {
    const dateStr = format(s.date, "MM/dd/yyyy");
    const subject = `${eventName} - ${tr.schedule.session} ${s.sessionNumber}${s.slotLabel ? ` (${s.slotLabel})` : ""}`;
    const effLocation = s.location ?? baseLocation;
    const effNotes = s.notes ?? baseNotes;
    const desc = [
      `${tr.schedule.session} ${s.sessionNumber} ${tr.export.description.split(' ')[0]} ${eventName}`,
      effNotes,
    ].filter(Boolean).join("\n\n");
    return [subject, dateStr, convertTo12Hour(s.startTime), dateStr, convertTo12Hour(s.endTime), "False", desc, effLocation, ""];
  });
  const neutralize = (c: string) => /^[=+\-@\t\r]/.test(c) ? `'${c}` : c;
  const esc = (c: string) => `"${neutralize(String(c)).replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

function buildIcs(sessions: Session[], eventName: string, language: string, opts: ExportOptions): string {
  const tr = language === 'id' ? id : en;
  const tz = opts.timezone || "UTC";
  const useFloat = tz !== "UTC";
  const fmt = (d: Date, time: string) => {
    if (useFloat) {
      const [h, m] = time.split(":");
      const y = d.getFullYear().toString().padStart(4, "0");
      const mo = (d.getMonth() + 1).toString().padStart(2, "0");
      const dd = d.getDate().toString().padStart(2, "0");
      return `${y}${mo}${dd}T${h.padStart(2, "0")}${m.padStart(2, "0")}00`;
    }
    const [hh, mm] = time.split(":");
    const dt = new Date(d);
    dt.setHours(parseInt(hh), parseInt(mm), 0, 0);
    return dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };
  const pfx = useFloat ? `;TZID=${tz}` : "";
  const events = sessions.map((s) => {
    const summary = tr.export.summary.replace('{{eventName}}', eventName).replace('{{sessionNumber}}', String(s.sessionNumber)) + (s.slotLabel ? ` (${s.slotLabel})` : "");
    const desc = tr.export.description.replace('{{sessionNumber}}', String(s.sessionNumber)).replace('{{eventName}}', eventName) + (s.notes ? `\n\n${s.notes}` : "");
    const effLoc = s.location ?? opts.location;
    const lines = [
      "BEGIN:VEVENT",
      `DTSTART${pfx}:${fmt(s.date, s.startTime)}`,
      `DTEND${pfx}:${fmt(s.date, s.endTime)}`,
      `SUMMARY:${escapeICS(summary)}`,
      `DESCRIPTION:${escapeICS(desc)}`,
    ];
    if (effLoc) lines.push(`LOCATION:${escapeICS(effLoc)}`);
    lines.push(`UID:${Date.now()}-${s.sessionNumber}-${(s.trackId ?? "").replace(/[^A-Za-z0-9_-]/g, "")}@schedule-generator.com`);
    if (opts.reminderMinutes && opts.reminderMinutes > 0) {
      const m = opts.reminderMinutes;
      const trig = m % 1440 === 0 ? `-P${m / 1440}D` : m % 60 === 0 ? `-PT${m / 60}H` : `-PT${m}M`;
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeICS(summary)}`, `TRIGGER:${trig}`, "END:VALARM");
    }
    lines.push("END:VEVENT");
    return lines.join("\r\n");
  }).join("\r\n");
  const vtz = useFloat ? ["BEGIN:VTIMEZONE", `TZID:${tz}`, "END:VTIMEZONE"].join("\r\n") : null;
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Schedule Generator//EN", "CALSCALE:GREGORIAN", ...(vtz ? [vtz] : []), events, "END:VCALENDAR"].join("\r\n");
}

function hexToRgb(hex: string): [number, number, number] {
  const h = (hex || "#0ea5e9").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [14, 165, 233];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function buildPdfBlob(sessions: Session[], eventName: string, language: string, opts: ExportOptions, branding: Branding, t: T): ArrayBuffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const dateLocale = language === "id" ? idLocale : enUS;
  const accent = hexToRgb(branding.accentColor || "#0ea5e9");
  const headerH = 60;
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, pageW, headerH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(branding.orgName || eventName || "Schedule", marginX, 36);

  doc.setTextColor(20, 20, 20);
  let y = headerH + 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(eventName, marginX, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  if (opts.location) { doc.text(`${t("pdf.location")}: ${opts.location}`, marginX, y); y += 14; }
  if (sessions.length > 0) {
    const first = sessions[0].date;
    const last = sessions[sessions.length - 1].date;
    doc.text(`${t("pdf.sessions")}: ${sessions.length}`, marginX, y); y += 14;
    doc.text(`${t("pdf.dateRange")}: ${format(first, "MMM d, yyyy", { locale: dateLocale })} – ${format(last, "MMM d, yyyy", { locale: dateLocale })}`, marginX, y); y += 14;
  }
  y += 6;

  const head = [t("pdf.col.num"), t("pdf.col.date"), t("pdf.col.day"), t("pdf.col.time")];
  const body = sessions.map((s) => [
    String(s.sessionNumber),
    format(s.date, "yyyy-MM-dd", { locale: dateLocale }),
    format(s.date, "EEE", { locale: dateLocale }),
    `${s.startTime} – ${s.endTime}${s.slotLabel ? ` (${s.slotLabel})` : ""}`,
  ]);
  autoTable(doc, {
    startY: y, head: [head], body,
    margin: { left: marginX, right: marginX, top: 32, bottom: 40 },
    styles: { fontSize: 9, cellPadding: 6, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [accent[0], accent[1], accent[2]], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 0: { cellWidth: 28, halign: "right" }, 1: { cellWidth: 70 }, 2: { cellWidth: 36 } },
  });
  return doc.output("arraybuffer") as ArrayBuffer;
}

export async function exportPerTrackZip(
  byTrack: Record<string, Session[]>,
  tracks: Track[],
  projectName: string,
  exportFormat: "csv" | "ics" | "pdf",
  opts: ExportOptions,
  branding: Branding,
  t: T,
  language: string,
): Promise<void> {
  const zip = new JSZip();
  for (const track of tracks) {
    const list = byTrack[track.id] ?? [];
    if (list.length === 0) continue;
    const fileBase = sanitize(`${projectName || "schedule"}-${track.name}`);
    const trackOpts: ExportOptions = {
      ...opts,
      location: track.location ?? opts.location,
      notes: track.notes ?? opts.notes,
    };
    if (exportFormat === "csv") {
      zip.file(`${fileBase}.csv`, buildCsv(list, track.name, language, trackOpts));
    } else if (exportFormat === "ics") {
      zip.file(`${fileBase}.ics`, buildIcs(list, track.name, language, trackOpts));
    } else {
      const blob = buildPdfBlob(list, track.name, language, trackOpts, branding, t);
      zip.file(`${fileBase}.pdf`, blob);
    }
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitize(projectName || "schedule")}-${exportFormat}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
