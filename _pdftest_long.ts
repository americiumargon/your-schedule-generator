import { mkdirSync, writeFileSync } from 'fs';
import { jsPDF } from 'jspdf';
// stub doc.save then capture
const origSave = jsPDF.prototype.save;
let captured: { name: string; buf: Buffer } | null = null;
jsPDF.prototype.save = function (name: string) {
  captured = { name, buf: Buffer.from(this.output('arraybuffer')) };
};

const { exportToPDF } = await import('./src/utils/pdfExport.ts');

mkdirSync('/tmp/pdftest', { recursive: true });

const t = (k: string, opts?: any) => {
  if (k === 'pdf.page') return `Page ${opts.current} / ${opts.total}`;
  return k.split('.').pop()!;
};

const mkSessions = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    date: new Date(2026, 0, (i % 28) + 1),
    sessionNumber: i + 1,
    startTime: '09:00',
    endTime: '10:30',
  }));

function run(label: string, branding: any, sessions: any[]) {
  captured = null;
  exportToPDF(sessions, 'My Event', 'en', {}, branding, t);
  if (captured) {
    writeFileSync(`/tmp/pdftest/${label}.pdf`, captured.buf);
    console.log(`${label}: saved`);
  }
}

run('long1', {
  orgName: 'The Extraordinarily Long International Academy of Advanced Mathematical Sciences and Computational Engineering Studies',
  tagline: "Empowering tomorrow's leaders through rigorous interdisciplinary education programs spanning more than three decades of academic excellence worldwide",
  footerText: 'www.this-is-a-very-long-domain-name-for-testing-purposes.example.com · contact@example.com · +1 (555) 123-4567',
  accentColor: '#0ea5e9',
}, mkSessions(40));

run('long2', {
  orgName: 'Supercalifragilisticexpialidocious'.repeat(4),
  tagline: 'Pneumonoultramicroscopicsilicovolcanoconiosis'.repeat(2),
  footerText: 'verylongwordwithoutspacesthatcannotbewrapped'.repeat(3),
  accentColor: '#dc2626',
}, mkSessions(30));
