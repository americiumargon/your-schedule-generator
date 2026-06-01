import { mkdirSync, writeFileSync } from 'fs';
import { jsPDF } from 'jspdf';
let captured: any = null;
const origOutput = jsPDF.prototype.output;
Object.defineProperty(jsPDF.prototype, 'save', {
  configurable: true,
  writable: true,
  value: function(name: string) {
    captured = { name, buf: Buffer.from(this.output('arraybuffer')) };
  }
});
const mod = await import('./src/utils/pdfExport.ts');
const t = (k: string, opts?: any) => k === 'pdf.page' ? `Page ${opts.current} / ${opts.total}` : k.split('.').pop()!;

function run(label: string, branding: any, n=40){
  captured=null;
  mod.exportToPDF(
    Array.from({length:n},(_,i)=>({date:new Date(2026,0,(i%28)+1),sessionNumber:i+1,startTime:'09:00',endTime:'10:30'})),
    'My Event','en',{},branding,t);
  if(!captured){console.log(label,'NOT CAPTURED');return;}
  writeFileSync(`/tmp/pdftest/${label}.pdf`, captured.buf);
  console.log(label,'ok',captured.buf.length);
}
mkdirSync('/tmp/pdftest',{recursive:true});
run('fix-long1',{orgName:'The Extraordinarily Long International Academy of Advanced Mathematical Sciences and Computational Engineering Studies',tagline:"Empowering tomorrow's leaders through rigorous interdisciplinary education programs spanning more than three decades of academic excellence worldwide",footerText:'www.this-is-a-very-long-domain-name-for-testing-purposes.example.com · contact@example.com · +1 (555) 123-4567',accentColor:'#0ea5e9'});
run('fix-long2',{orgName:'Supercalifragilisticexpialidocious'.repeat(4),tagline:'Pneumonoultramicroscopicsilicovolcanoconiosis'.repeat(2),footerText:'verylongwordwithoutspacesthatcannotbewrapped'.repeat(3),accentColor:'#dc2626'},30);
