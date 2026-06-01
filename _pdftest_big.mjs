import { exportToPDF } from '/dev-server/src/utils/pdfExport.ts';
import jsPDF from 'jspdf';
import fs from 'fs';
jsPDF.prototype.save = function(filename) {
  fs.writeFileSync(`/dev-server/${filename}`, Buffer.from(this.output('arraybuffer')));
};
const sessions = [];
const start = new Date(2026, 0, 1);
for (let i = 0; i < 250; i++) {
  const d = new Date(start); d.setDate(start.getDate() + i);
  sessions.push({
    date: d, sessionNumber: i+1, startTime: '09:00', endTime: '10:30',
    slotLabel: i % 7 === 0 ? 'Morning' : undefined,
    location: i % 3 === 0 ? 'Studio A' : 'Main Hall',
    notes: i % 11 === 0 ? 'This is a longer note that should wrap nicely across multiple lines in the PDF cell without overflowing or causing layout issues.' : undefined,
  });
}
const t = (k, o) => ({
  'schedule.title':'Schedule','pdf.location':'Location','pdf.timezone':'Timezone',
  'pdf.sessions':'Sessions','pdf.dateRange':'Date range',
  'pdf.col.num':'#','pdf.col.date':'Date','pdf.col.day':'Day','pdf.col.time':'Time',
  'pdf.col.location':'Location','pdf.col.notes':'Notes',
  'pdf.page':`Page ${o?.current} / ${o?.total}`,
}[k] || k);
exportToPDF(sessions, 'Big Cohort 2026', 'en',
  { location: 'Main Hall', timezone: 'Asia/Jakarta', notes: 'Year-long program' },
  { orgName: 'Big Academy', tagline: 'Full year cohort', accentColor: '#7c3aed', footerText: 'bigacademy.example.com' }, t);
console.log('done');
