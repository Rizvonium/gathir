/**
 * Owner report print CSS (PLAN §7). A flowing A4 document (the print engine paginates),
 * calmer than the catalogue: it is a working record, so hierarchy and legibility come first.
 */
export const ownerReportCss = `
@page{size:A4;margin:14mm 14mm 16mm;}
body{background:var(--white);font-size:9pt;}
section{margin-top:9mm;}
h2{font-size:15pt;color:var(--walnut);margin-bottom:3mm;padding-bottom:1.5mm;border-bottom:0.75pt solid var(--chinar);
  break-after:avoid;page-break-after:avoid;}
h3{font-size:10.5pt;font-weight:600;margin:4mm 0 2mm;break-after:avoid;page-break-after:avoid;}
.empty{color:var(--muted);font-size:9pt;}
.spaced{margin-top:3mm;}
.lead{margin-bottom:2mm;}
.thumb-cell{width:15mm;}

.masthead{display:flex;justify-content:space-between;align-items:flex-end;gap:8mm;}
.masthead .shop{font-size:24pt;color:var(--chinar);}
.masthead .kind{font-family:var(--display);font-weight:600;font-size:12pt;margin-top:1mm;}
.masthead .facts{text-align:end;font-size:8.5pt;line-height:1.6;color:var(--muted);}
.masthead .facts strong{color:var(--walnut);font-weight:700;}
.vine{height:8mm;margin-top:3mm;}
.vine svg{width:100%;height:100%;}

.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;}
.stat{background:var(--ivory);border:0.6pt solid var(--rule);border-radius:2mm;padding:3mm 3.5mm;}
.stat .label{font-size:8pt;color:var(--muted);}
.stat .value{font-family:var(--display);font-weight:700;font-size:17pt;line-height:1.2;margin-top:0.5mm;}
.stat.amount .value{color:var(--chinar);}
.split{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:2mm;}

table{width:100%;border-collapse:collapse;font-size:8.5pt;}
thead{display:table-header-group;}
th{text-align:start;font-weight:600;color:var(--muted);font-size:7.5pt;padding:1.5mm 2mm;border-bottom:0.6pt solid var(--rule);}
td{padding:1.6mm 2mm;border-bottom:0.4pt solid var(--rule);vertical-align:top;}
tr{break-inside:avoid;page-break-inside:avoid;}
th.r,td.r{text-align:end;}
td.amt{font-weight:700;}
tfoot td{font-weight:700;border-bottom:none;border-top:0.75pt solid var(--walnut);}

.sale{border:0.6pt solid var(--rule);border-radius:2mm;margin-bottom:3.5mm;break-inside:avoid;page-break-inside:avoid;}
.sale-head{display:flex;justify-content:space-between;gap:4mm;padding:2.5mm 3mm;background:var(--ivory);
  border-bottom:0.6pt solid var(--rule);border-radius:2mm 2mm 0 0;}
.sale-head .when{font-weight:700;}
.sale-head .bill{color:var(--muted);font-size:8pt;}
.sale-head .who{text-align:end;font-size:8.5pt;line-height:1.45;}
.sale-head .who .name{font-weight:700;}
.sale table td{border-bottom:none;}
.sale-foot{display:flex;justify-content:flex-end;gap:6mm;padding:1.5mm 3mm 2.5mm;font-size:8.5pt;}
.sale-foot .total{font-weight:700;}
.sale-note{padding:0 3mm 2.5mm;font-size:8pt;color:var(--muted);}

.thumb{width:13mm;height:13mm;border-radius:1.5mm;overflow:hidden;background:var(--sand);}
.thumb img,.thumb svg{width:100%;height:100%;object-fit:cover;}
.item-name{font-weight:600;}
.code{font-size:7.5pt;color:var(--muted);}
.sw{display:inline-flex;align-items:center;gap:1.2mm;white-space:nowrap;margin-inline-end:2.5mm;}
.dot{display:inline-block;width:2.6mm;height:2.6mm;border-radius:50%;border:0.5pt solid rgba(43,26,18,0.25);flex:none;}
.dot.multi{background:repeating-linear-gradient(135deg,var(--chinar) 0 0.6mm,var(--saffron) 0.6mm 1.2mm,var(--teal) 1.2mm 1.8mm);}

.minus{color:var(--chinar);font-weight:700;}
.plus{color:var(--meadow);font-weight:700;}

/* Stock status: text + marker + colour. */
.status{display:inline-flex;align-items:center;gap:1.2mm;font-size:7.5pt;font-weight:700;white-space:nowrap;}
.status::before{content:"";width:1.8mm;height:1.8mm;border-radius:50%;background:currentColor;}
.status.in{color:var(--meadow);}
.status.low{color:var(--low);}
.status.out{color:var(--chinar);}
tr.low td{background:rgba(244,163,0,0.10);}
tr.out td{background:rgba(198,47,23,0.07);}

.doc-foot{margin-top:10mm;padding-top:3mm;border-top:0.6pt solid var(--rule);display:flex;flex-wrap:wrap;
  justify-content:space-between;gap:2mm 6mm;font-size:7.5pt;color:var(--muted);}
.doc-foot .fp{font-weight:700;color:var(--walnut);letter-spacing:0.04em;}
`;
