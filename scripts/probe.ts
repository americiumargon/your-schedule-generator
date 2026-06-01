import jsPDF from "jspdf";
console.log("API.save:", typeof (jsPDF as any).API?.save);
console.log("proto.save:", typeof (jsPDF as any).prototype?.save);
const d = new jsPDF();
console.log("instance.save:", typeof (d as any).save);
console.log("own keys with save:", Object.getOwnPropertyNames(d).filter(k=>k.includes("save")));
let proto = Object.getPrototypeOf(d);
while (proto) { const n = Object.getOwnPropertyNames(proto).filter(k=>k.includes("save")); if (n.length) console.log("proto chain save:", n, proto.constructor?.name); proto = Object.getPrototypeOf(proto); }
