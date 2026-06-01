import { mkdirSync, writeFileSync } from 'fs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

mkdirSync('/tmp/pdftest', { recursive: true });

function hexToRgb(hex){const h=hex.replace('#','');const n=parseInt(h,16);return [(n>>16)&255,(n>>8)&255,n&255];}

function makePdf({orgName, tagline, footerText, sessions, file, accent='#0ea5e9'}) {
  const doc = new jsPDF({unit:'pt',format:'a4'});
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const acc = hexToRgb(accent);
  const headerH = 80;
  doc.setFillColor(...acc);
  doc.rect(0,0,pageW,headerH,'F');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold');
  doc.setFontSize(18);
  doc.text(orgName, marginX, 36);
  if (tagline) {
    doc.setFont('helvetica','normal');
    doc.setFontSize(11);
    doc.text(tagline, marginX, 56);
  }

  const body = sessions.map((s,i)=>[String(i+1), '2026-01-'+String((i%28)+1).padStart(2,'0'),'Mon','09:00 – 10:30']);

  autoTable(doc, {
    startY: headerH+40,
    head: [['#','Date','Day','Time']],
    body,
    margin:{left:marginX,right:marginX,top:32,bottom:40},
    styles:{fontSize:9,cellPadding:6},
    headStyles:{fillColor:acc,textColor:[255,255,255],fontStyle:'bold'},
    columnStyles:{0:{cellWidth:28,halign:'right'},1:{cellWidth:70},2:{cellWidth:36},3:{cellWidth:100}},
    didDrawPage:(data)=>{
      if (data.pageNumber>1){
        doc.setFillColor(...acc);
        doc.rect(0,0,pageW,18,'F');
        doc.setFont('helvetica','bold');
        doc.setFontSize(9);
        doc.setTextColor(255,255,255);
        doc.text(orgName, marginX, 12);
      }
    }
  });

  const pageCount = doc.getNumberOfPages();
  for (let i=1;i<=pageCount;i++){
    doc.setPage(i);
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.setTextColor(120,120,120);
    const footerY = pageH-20;
    if (footerText) doc.text(footerText, pageW/2, footerY, {align:'center'});
    doc.text(`Page ${i} / ${pageCount}`, pageW-marginX, footerY, {align:'right'});
  }

  writeFileSync(file, Buffer.from(doc.output('arraybuffer')));
  console.log(`${file}: ${pageCount} pages`);
}

// Case 1: very long org name
makePdf({
  orgName: 'The Extraordinarily Long International Academy of Advanced Mathematical Sciences and Computational Engineering Studies',
  tagline: 'Empowering tomorrow\'s leaders through rigorous interdisciplinary education programs spanning more than three decades of academic excellence worldwide',
  footerText: 'www.this-is-a-very-long-domain-name-for-testing-purposes.example.com · contact@example.com · +1 (555) 123-4567',
  sessions: Array.from({length:40},()=>({})),
  file:'/tmp/pdftest/long1.pdf'
});

// Case 2: pathological single word
makePdf({
  orgName: 'Supercalifragilisticexpialidocious'.repeat(4),
  tagline: 'Pneumonoultramicroscopicsilicovolcanoconiosis'.repeat(2),
  footerText: 'verylongwordwithoutspacesthatcannotbewrapped'.repeat(3),
  sessions: Array.from({length:30},()=>({})),
  file:'/tmp/pdftest/long2.pdf',
  accent:'#dc2626'
});
