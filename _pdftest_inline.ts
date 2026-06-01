// Inline replica using exact production logic
import { mkdirSync, writeFileSync } from 'fs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
function hexToRgb(h:string):[number,number,number]{const n=parseInt(h.replace('#',''),16);return [(n>>16)&255,(n>>8)&255,n&255];}

function exportPdf(sessions:any[], branding:any, file:string){
  const doc = new jsPDF({unit:'pt',format:'a4'});
  const pageW=doc.internal.pageSize.getWidth();
  const pageH=doc.internal.pageSize.getHeight();
  const marginX=40;
  const accent=hexToRgb(branding.accentColor||'#0ea5e9');
  const headerH=80;
  doc.setFillColor(...accent);
  doc.rect(0,0,pageW,headerH,'F');
  let textX=marginX;
  doc.setTextColor(255,255,255);
  const headerTextMaxW=pageW-textX-marginX;
  const fitText=(text:string,maxW:number,startSize:number,minSize:number,style:'bold'|'normal')=>{
    doc.setFont('helvetica',style);
    let size=startSize; doc.setFontSize(size);
    while(size>minSize && doc.getTextWidth(text)>maxW){size--;doc.setFontSize(size);}
    let out=text;
    if(doc.getTextWidth(out)>maxW){
      const e='…';
      while(out.length>1 && doc.getTextWidth(out+e)>maxW)out=out.slice(0,-1);
      out=out.trimEnd()+e;
    }
    return {text:out,size};
  };
  const titleSrc=branding.orgName||'Schedule';
  const title=fitText(titleSrc,headerTextMaxW,18,12,'bold');
  doc.setFont('helvetica','bold'); doc.setFontSize(title.size);
  doc.text(title.text,textX,36);
  if(branding.tagline){
    const tag=fitText(branding.tagline,headerTextMaxW,11,8,'normal');
    doc.setFont('helvetica','normal'); doc.setFontSize(tag.size);
    doc.text(tag.text,textX,56);
  }
  const body=sessions.map((s,i)=>[String(i+1),'2026-01-'+String((i%28)+1).padStart(2,'0'),'Mon','09:00 – 10:30']);
  autoTable(doc,{
    startY:headerH+40,head:[['#','Date','Day','Time']],body,
    margin:{left:marginX,right:marginX,top:32,bottom:40},
    styles:{fontSize:9,cellPadding:6},
    headStyles:{fillColor:accent,textColor:[255,255,255],fontStyle:'bold'},
    columnStyles:{0:{cellWidth:28,halign:'right'},1:{cellWidth:70},2:{cellWidth:36},3:{cellWidth:100}},
    didDrawPage:(data:any)=>{
      if(data.pageNumber>1){
        doc.setFillColor(...accent);
        doc.rect(0,0,pageW,18,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(255,255,255);
        const brand=branding.orgName||'';
        if(brand){const f=fitText(brand,pageW-marginX*2,9,7,'bold');doc.setFontSize(f.size);doc.text(f.text,marginX,12);}
      }
    }
  });
  const pageCount=doc.getNumberOfPages();
  for(let i=1;i<=pageCount;i++){
    doc.setPage(i);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(120,120,120);
    const footerY=pageH-20;
    const pageLabel=`Page ${i} / ${pageCount}`;
    const pageLabelW=doc.getTextWidth(pageLabel);
    if(branding.footerText){
      const reserved=pageLabelW+16;
      const footerMaxW=pageW-marginX*2-reserved*2;
      const fitted=fitText(branding.footerText,footerMaxW,9,7,'normal');
      doc.setFontSize(fitted.size);
      doc.text(fitted.text,pageW/2,footerY,{align:'center'});
      doc.setFontSize(9);
    }
    doc.text(pageLabel,pageW-marginX,footerY,{align:'right'});
  }
  writeFileSync(file,Buffer.from(doc.output('arraybuffer')));
  console.log(file,'pages:',pageCount);
}
mkdirSync('/tmp/pdftest',{recursive:true});
exportPdf(Array.from({length:40}),{
  orgName:'The Extraordinarily Long International Academy of Advanced Mathematical Sciences and Computational Engineering Studies',
  tagline:"Empowering tomorrow's leaders through rigorous interdisciplinary education programs spanning more than three decades of academic excellence worldwide",
  footerText:'www.this-is-a-very-long-domain-name-for-testing-purposes.example.com · contact@example.com · +1 (555) 123-4567',
  accentColor:'#0ea5e9'
},'/tmp/pdftest/fix1.pdf');
exportPdf(Array.from({length:30}),{
  orgName:'Supercalifragilisticexpialidocious'.repeat(4),
  tagline:'Pneumonoultramicroscopicsilicovolcanoconiosis'.repeat(2),
  footerText:'verylongwordwithoutspacesthatcannotbewrapped'.repeat(3),
  accentColor:'#dc2626'
},'/tmp/pdftest/fix2.pdf');
