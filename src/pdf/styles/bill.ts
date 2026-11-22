/** Bill print CSS: A5, one narrow column (max 100 mm) so it also suits 80 mm receipt printers. */
export const billCss = `
@page{size:A5;margin:10mm;}
body{background:var(--white);font-size:9.5pt;}
.bill{max-width:100mm;margin:0 auto;position:relative;}
header{text-align:center;}
h1{font-size:20pt;color:var(--chinar);overflow-wrap:anywhere;}
.addr{margin-top:1.5mm;font-size:8.5pt;color:var(--muted);}
header .num{font-size:8.5pt;margin-top:0.5mm;}
.vine{height:5mm;margin:3mm 0 3.5mm;}
.vine svg{width:100%;height:100%;}
.facts{display:grid;grid-template-columns:1fr 1fr;gap:2mm 4mm;margin:0 0 4mm;}
.facts .wide{grid-column:1 / -1;}
.facts dt{font-size:7.5pt;color:var(--muted);}
.facts dd{margin:0;font-weight:600;}
table{width:100%;border-collapse:collapse;}
th{text-align:start;font-size:7.5pt;font-weight:600;color:var(--muted);padding:1.2mm 0;border-bottom:0.6pt solid var(--rule);}
td{padding:1.8mm 0;vertical-align:top;border-bottom:0.4pt solid var(--rule);}
th.r,td.r{text-align:end;}
td.r{padding-inline-start:3mm;white-space:nowrap;}
.item{font-weight:600;}
.sub{font-size:8pt;color:var(--muted);}
.amt{font-weight:700;}
.totals{margin-top:2mm;}
.totals td{border-bottom:none;padding:1mm 0;}
.totals .grand td{font-family:var(--display);font-weight:700;font-size:15pt;padding-top:2mm;border-top:0.75pt solid var(--walnut);}
.paid{margin-top:3mm;font-weight:600;}
.note{margin-top:2mm;font-size:8.5pt;color:var(--muted);}
.upi{margin-top:3mm;padding:2mm 3mm;border:0.6pt solid var(--teal);border-radius:1.5mm;color:var(--teal);font-weight:600;}
.thanks{margin-top:6mm;text-align:center;font-family:var(--display);font-weight:600;font-size:12pt;}
.stamp{position:absolute;top:30mm;inset-inline-end:0;transform:rotate(-8deg);padding:1.5mm 4mm;border:1.2pt solid var(--chinar);
  border-radius:1.5mm;color:var(--chinar);font-weight:700;font-size:12pt;}
`;
