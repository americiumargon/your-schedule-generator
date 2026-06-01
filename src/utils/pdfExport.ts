import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import type { Branding } from "./branding";

interface PdfSession {
  date: Date;
  sessionNumber: number;
  startTime: string;
  endTime: string;
  slotLabel?: string;
  location?: string;
  notes?: string;
}

interface ExportOpts {
  location?: string;
  notes?: string;
  timezone?: string;
}

const DEFAULT_ACCENT = "#0ea5e9";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  if (Number.isNaN(num) || full.length !== 6) return [14, 165, 233];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function sanitizeFilename(s: string): string {
  return (s || "schedule").replace(/[^\w\-]+/g, "_").slice(0, 80) || "schedule";
}

function getImageProps(doc: jsPDF, dataUrl: string): { w: number; h: number } | null {
  try {
    const props = doc.getImageProperties(dataUrl);
    return { w: props.width, h: props.height };
  } catch {
    return null;
  }
}

type T = (key: string, opts?: Record<string, unknown>) => string;

export function exportToPDF(
  sessions: PdfSession[],
  eventName: string,
  language: string,
  opts: ExportOpts,
  branding: Branding,
  t: T
): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const dateLocale = language === "id" ? idLocale : enUS;

  const accent = hexToRgb(branding.accentColor || DEFAULT_ACCENT);

  // Header band
  const headerH = 80;
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, pageW, headerH, "F");

  let textX = marginX;
  if (branding.logoDataUrl) {
    const props = getImageProps(doc, branding.logoDataUrl);
    if (props) {
      const maxH = 48;
      const maxW = 160;
      const ratio = props.w / props.h;
      let h = Math.min(maxH, props.h);
      let w = h * ratio;
      if (w > maxW) {
        w = maxW;
        h = w / ratio;
      }
      try {
        doc.addImage(branding.logoDataUrl, "PNG", marginX, (headerH - h) / 2, w, h, undefined, "FAST");
        textX = marginX + w + 16;
      } catch {
        // ignore bad logo
      }
    }
  }

  doc.setTextColor(255, 255, 255);

  // Constrain header text to available width (after logo); shrink + truncate as needed.
  const headerTextMaxW = pageW - textX - marginX;

  const fitText = (
    text: string,
    maxW: number,
    startSize: number,
    minSize: number,
    style: "bold" | "normal"
  ): { text: string; size: number } => {
    doc.setFont("helvetica", style);
    let size = startSize;
    while (size > minSize && doc.getStringUnitWidth(text) * size > maxW) {
      size -= 1;
    }
    doc.setFontSize(size);
    let out = text;
    if (doc.getTextWidth(out) > maxW) {
      const ellipsis = "…";
      while (out.length > 1 && doc.getTextWidth(out + ellipsis) > maxW) {
        out = out.slice(0, -1);
      }
      out = out.trimEnd() + ellipsis;
    }
    return { text: out, size };
  };

  const titleSrc = branding.orgName || eventName || "Schedule";
  const title = fitText(titleSrc, headerTextMaxW, 18, 12, "bold");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(title.size);
  doc.text(title.text, textX, 36);
  if (branding.tagline) {
    const tag = fitText(branding.tagline, headerTextMaxW, 11, 8, "normal");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(tag.size);
    doc.text(tag.text, textX, 56);
  }


  // Info block
  doc.setTextColor(20, 20, 20);
  let y = headerH + 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(eventName || t("schedule.title"), marginX, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);

  const infoLines: string[] = [];
  if (opts.location) infoLines.push(`${t("pdf.location")}: ${opts.location}`);
  if (opts.timezone) infoLines.push(`${t("pdf.timezone")}: ${opts.timezone}`);
  if (sessions.length > 0) {
    const first = sessions[0].date;
    const last = sessions[sessions.length - 1].date;
    const range = `${format(first, "MMM d, yyyy", { locale: dateLocale })} – ${format(last, "MMM d, yyyy", { locale: dateLocale })}`;
    infoLines.push(`${t("pdf.sessions")}: ${sessions.length}`);
    infoLines.push(`${t("pdf.dateRange")}: ${range}`);
  }
  for (const line of infoLines) {
    doc.text(line, marginX, y);
    y += 14;
  }
  if (opts.notes) {
    y += 4;
    const wrapped = doc.splitTextToSize(opts.notes, pageW - marginX * 2);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 12;
  }
  y += 10;

  // Table
  const hasLocation = sessions.some((s) => s.location || opts.location);
  const hasNotes = sessions.some((s) => s.notes || opts.notes);

  const head: string[] = [
    t("pdf.col.num"),
    t("pdf.col.date"),
    t("pdf.col.day"),
    t("pdf.col.time"),
  ];
  if (hasLocation) head.push(t("pdf.col.location"));
  if (hasNotes) head.push(t("pdf.col.notes"));

  const body = sessions.map((s) => {
    const row: string[] = [
      String(s.sessionNumber),
      format(s.date, "yyyy-MM-dd", { locale: dateLocale }),
      format(s.date, "EEE", { locale: dateLocale }),
      `${s.startTime} – ${s.endTime}${s.slotLabel ? ` (${s.slotLabel})` : ""}`,
    ];
    if (hasLocation) row.push(s.location ?? opts.location ?? "");
    if (hasNotes) row.push(s.notes ?? "");
    return row;
  });

  // Compute a Time column width wide enough for "HH:MM – HH:MM (Label)" so
  // it doesn't wrap on every row and balloon the page count for long schedules.
  const timeSamples = body.map((r) => r[3]);
  const longestTime = timeSamples.reduce((a, b) => (b.length > a.length ? b : a), "00:00 – 00:00");
  // Approximate width: 9pt helvetica avg ~5pt per char, plus 12pt padding.
  const timeColW = Math.min(140, Math.max(60, Math.ceil(longestTime.length * 5.2) + 12));

  const colStyles: Record<number, { cellWidth?: number; halign?: "left" | "right" | "center" }> = {
    0: { cellWidth: 28, halign: "right" },
    1: { cellWidth: 70 },
    2: { cellWidth: 36 },
    3: { cellWidth: timeColW },
  };

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    margin: { left: marginX, right: marginX, top: 32, bottom: 40 },
    styles: { fontSize: 9, cellPadding: 6, overflow: "linebreak", valign: "middle" },
    headStyles: {
      fillColor: [accent[0], accent[1], accent[2]],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: colStyles,
    didDrawPage: (data) => {
      // Continuation-page brand strip: thin accent bar + org/event name + page label.
      // Skip on page 1 — it already has the full header band.
      if (data.pageNumber > 1) {
        doc.setFillColor(accent[0], accent[1], accent[2]);
        doc.rect(0, 0, pageW, 18, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        const brand = branding.orgName || eventName || "";
        if (brand) doc.text(brand, marginX, 12);
      }
    },
  });

  // Stamp footer on every page after table is complete (so totals are correct)
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    const footerY = pageH - 20;
    if (branding.footerText) {
      doc.text(branding.footerText, pageW / 2, footerY, { align: "center" });
    }
    doc.text(
      t("pdf.page", { current: i, total: pageCount }),
      pageW - marginX,
      footerY,
      { align: "right" }
    );
  }

  doc.save(`${sanitizeFilename(eventName)}.pdf`);
}
