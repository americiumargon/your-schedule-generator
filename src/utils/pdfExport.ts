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
  trackName?: string;
  trackColor?: string;
}

interface ExportOpts {
  location?: string;
  notes?: string;
  timezone?: string;
  includeTrackColumn?: boolean;
  filename?: string;
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

  const wantsCover =
    branding.coverPage !== false && !!(branding.logoDataUrl || branding.orgName);

  // ---------- Cover page ----------
  if (wantsCover) {
    // Top accent band ~ 42% of page height
    const bandH = pageH * 0.42;
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(0, 0, pageW, bandH, "F");

    // Centered large logo
    let logoBottomY = 80;
    if (branding.logoDataUrl) {
      const props = getImageProps(doc, branding.logoDataUrl);
      if (props) {
        const maxH = 180;
        const maxW = 280;
        const ratio = props.w / props.h;
        let h = Math.min(maxH, props.h);
        let w = h * ratio;
        if (w > maxW) {
          w = maxW;
          h = w / ratio;
        }
        const x = (pageW - w) / 2;
        const y = (bandH - h) / 2;
        try {
          doc.addImage(branding.logoDataUrl, "PNG", x, y, w, h, undefined, "FAST");
          logoBottomY = y + h;
        } catch {
          // ignore bad logo
        }
      }
    }

    // Below the band: text block
    let cy = bandH + 48;
    doc.setTextColor(20, 20, 20);
    if (branding.orgName) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.text(branding.orgName, pageW / 2, cy, { align: "center" });
      cy += 30;
    }
    if (branding.tagline) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(13);
      doc.setTextColor(80, 80, 80);
      doc.text(branding.tagline, pageW / 2, cy, { align: "center" });
      cy += 22;
    }
    if (eventName) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(20, 20, 20);
      doc.text(eventName, pageW / 2, cy, { align: "center" });
      cy += 28;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    if (sessions.length > 0) {
      const first = sessions[0].date;
      const last = sessions[sessions.length - 1].date;
      const range = `${format(first, "MMM d, yyyy", { locale: dateLocale })} – ${format(last, "MMM d, yyyy", { locale: dateLocale })}`;
      doc.text(range, pageW / 2, cy, { align: "center" });
      cy += 16;
      doc.text(`${t("pdf.sessions")}: ${sessions.length}`, pageW / 2, cy, { align: "center" });
      cy += 16;
    }
    if (opts.location) {
      doc.text(`${t("pdf.location")}: ${opts.location}`, pageW / 2, cy, { align: "center" });
      cy += 16;
    }
    if (opts.timezone) {
      doc.text(`${t("pdf.timezone")}: ${opts.timezone}`, pageW / 2, cy, { align: "center" });
      cy += 16;
    }

    if (branding.footerText) {
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(branding.footerText, pageW / 2, pageH - 30, { align: "center" });
    }

    // Suppress eslint unused-var warning on logoBottomY
    void logoBottomY;

    doc.addPage();
  }

  // ---------- Schedule first page header ----------
  // When cover is on, use a slim accent strip (logo repeats via didDrawPage).
  // When cover is off, render the original tall header band with logo.
  const headerH = wantsCover ? 0 : 80;
  if (!wantsCover) {
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(0, 0, pageW, headerH, "F");
  }

  let textX = marginX;
  if (!wantsCover && branding.logoDataUrl) {
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
    doc.setFontSize(size);
    while (size > minSize && doc.getTextWidth(text) > maxW) {
      size -= 1;
      doc.setFontSize(size);
    }
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


  if (!wantsCover) {
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
  }


  // Info block
  doc.setTextColor(20, 20, 20);
  let y = (wantsCover ? 40 : headerH + 28);
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
  const hasTrack = !!opts.includeTrackColumn && sessions.some((s) => s.trackName);

  const head: string[] = [
    t("pdf.col.num"),
    t("pdf.col.date"),
    t("pdf.col.day"),
    t("pdf.col.time"),
  ];
  if (hasTrack) head.push(t("pdf.col.track"));
  if (hasLocation) head.push(t("pdf.col.location"));
  if (hasNotes) head.push(t("pdf.col.notes"));

  const body = sessions.map((s) => {
    const row: string[] = [
      String(s.sessionNumber),
      format(s.date, "yyyy-MM-dd", { locale: dateLocale }),
      format(s.date, "EEE", { locale: dateLocale }),
      `${s.startTime} – ${s.endTime}${s.slotLabel ? ` (${s.slotLabel})` : ""}`,
    ];
    if (hasTrack) row.push(s.trackName ?? "");
    if (hasLocation) row.push(s.location ?? opts.location ?? "");
    if (hasNotes) row.push(s.notes ?? "");
    return row;
  });

  const timeSamples = body.map((r) => r[3]);
  const longestTime = timeSamples.reduce((a, b) => (b.length > a.length ? b : a), "00:00 – 00:00");
  const timeColW = Math.min(140, Math.max(60, Math.ceil(longestTime.length * 5.2) + 12));

  const colStyles: Record<number, { cellWidth?: number; halign?: "left" | "right" | "center" }> = {
    0: { cellWidth: 28, halign: "right" },
    1: { cellWidth: 70 },
    2: { cellWidth: 36 },
    3: { cellWidth: timeColW },
  };
  const trackColIdx = hasTrack ? 4 : -1;
  if (hasTrack) colStyles[4] = { cellWidth: 90 };

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
    didParseCell: (data) => {
      if (hasTrack && data.section === "body" && data.column.index === trackColIdx) {
        // reserve left padding for dot
        data.cell.styles.cellPadding = { top: 6, right: 6, bottom: 6, left: 16 };
      }
    },
    didDrawCell: (data) => {
      if (
        hasTrack &&
        data.section === "body" &&
        data.column.index === trackColIdx &&
        data.row.index < sessions.length
      ) {
        const s = sessions[data.row.index];
        if (s.trackColor) {
          const [r, g, b] = hexToRgb(s.trackColor);
          doc.setFillColor(r, g, b);
          const cx = data.cell.x + 7;
          const cy = data.cell.y + data.cell.height / 2;
          doc.circle(cx, cy, 3, "F");
        }
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        doc.setFillColor(accent[0], accent[1], accent[2]);
        doc.rect(0, 0, pageW, 18, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        const brand = branding.orgName || eventName || "";
        if (brand) {
          const stripMaxW = pageW - marginX * 2;
          const fitted = fitText(brand, stripMaxW, 9, 7, "bold");
          doc.setFontSize(fitted.size);
          doc.text(fitted.text, marginX, 12);
        }
      }
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    const footerY = pageH - 20;
    const pageLabel = t("pdf.page", { current: i, total: pageCount });
    const pageLabelW = doc.getTextWidth(pageLabel);
    if (branding.footerText) {
      const reserved = pageLabelW + 16;
      const footerMaxW = pageW - marginX * 2 - reserved * 2;
      const fitted = fitText(branding.footerText, footerMaxW, 9, 7, "normal");
      doc.setFontSize(fitted.size);
      doc.text(fitted.text, pageW / 2, footerY, { align: "center" });
      doc.setFontSize(9);
    }
    doc.text(pageLabel, pageW - marginX, footerY, { align: "right" });
  }

  doc.save(`${sanitizeFilename(opts.filename || eventName)}.pdf`);
}
