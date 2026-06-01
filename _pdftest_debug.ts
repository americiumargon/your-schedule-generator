import { mkdirSync, writeFileSync } from 'fs';
import { jsPDF } from 'jspdf';
let captured: any = null;
(jsPDF.prototype as any).save = function (name: string) {
  captured = { name, buf: Buffer.from(this.output('arraybuffer')) };
};
const mod = await import('./src/utils/pdfExport.ts?bust=' + Date.now());
console.log('fitText source check:', mod.exportToPDF.toString().includes('getTextWidth(text) > maxW'));
const t = (k: string, opts?: any) => k === 'pdf.page' ? `Page ${opts.current} / ${opts.total}` : k.split('.').pop()!;
mod.exportToPDF(
  Array.from({length:40},(_,i)=>({date:new Date(2026,0,(i%28)+1),sessionNumber:i+1,startTime:'09:00',endTime:'10:30'})),
  'My Event','en',{},
  { orgName:'X'.repeat(120), tagline:'Y'.repeat(140), footerText:'www.this-is-a-very-long-domain-name-for-testing-purposes.example.com · contact@example.com · +1 (555) 123-4567', accentColor:'#0ea5e9' },
  t
);
mkdirSync('/tmp/pdftest',{recursive:true});
writeFileSync('/tmp/pdftest/debug.pdf', captured.buf);
