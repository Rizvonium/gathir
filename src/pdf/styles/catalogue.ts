/**
 * Catalogue print CSS (PLAN §6). Fixed A4 pages laid out in TS (see ../paginate.ts), so every
 * size here is in mm and every page is exactly one sheet. Two styles share the structure:
 * - bazaar: pashmina-ivory paper, chinar/saffron/teal accents, boteh frame and sozni vines.
 * - ivory: white paper, walnut ink, hairline rules, generous margins, kani corners only on the cover.
 */

/** Page box: a hair under 297 mm so rounding in the print engine never spills a blank sheet. */
export const PAGE_W_MM = 210;
export const PAGE_H_MM = 296.6;

export const catalogueCss = `
@page{size:A4;margin:0;}
.s-bazaar{--paper:var(--ivory);--card:var(--white);--accent:var(--chinar);--accent2:var(--teal);--ink:var(--walnut);}
.s-ivory{--paper:var(--white);--card:var(--white);--accent:var(--walnut);--accent2:var(--muted);--ink:var(--walnut);}

.page{position:relative;width:${PAGE_W_MM}mm;height:${PAGE_H_MM}mm;overflow:hidden;background:var(--paper);
  page-break-after:always;break-after:page;}
.page:last-child{page-break-after:auto;break-after:auto;}

/* Footer: shop name at start, page number at end, on every page. */
.foot{position:absolute;left:14mm;right:14mm;bottom:7mm;height:7mm;display:flex;align-items:center;
  justify-content:space-between;gap:6mm;font-size:7.5pt;color:var(--muted);}
.foot .shop{font-family:var(--display);font-weight:600;font-size:8pt;color:var(--ink);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70mm;}
.foot .vine{flex:1;height:4mm;max-width:60mm;}
.foot .vine svg{width:100%;height:100%;}
.s-ivory .foot{border-top:0.5pt solid var(--rule);padding-top:1.5mm;}

/* Running head on product pages. */
.head{position:absolute;left:14mm;right:14mm;top:11mm;height:9mm;display:flex;align-items:flex-end;
  justify-content:space-between;gap:6mm;border-bottom:0.75pt solid var(--accent);padding-bottom:1.5mm;}
.head .shop{font-family:var(--display);font-weight:700;font-size:11pt;color:var(--accent);white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;}
.head .title{font-size:8pt;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.s-ivory .head{border-bottom-width:0.5pt;border-bottom-color:var(--rule);}
.s-ivory .head .shop{font-weight:600;color:var(--walnut);}

/* Product grid: card height is fixed so 2×2 or 3×2 always fits one sheet. */
.grid{position:absolute;left:14mm;right:14mm;top:26mm;display:grid;align-content:start;}
.c2 .grid{grid-template-columns:repeat(2,1fr);gap:7mm 7mm;}
.c3 .grid{grid-template-columns:repeat(3,1fr);gap:7mm 6mm;}
.card{height:122mm;display:flex;flex-direction:column;background:var(--card);overflow:hidden;
  break-inside:avoid;page-break-inside:avoid;}
.s-bazaar .card{border:0.75pt solid var(--rule);border-radius:3mm;}
.photo{position:relative;flex:none;overflow:hidden;background:var(--sand);}
.c2 .photo{height:84mm;}
.c3 .photo{height:82mm;}
.s-ivory .photo{background:var(--ivory);}
.photo img,.photo svg{width:100%;height:100%;object-fit:cover;}
.code{position:absolute;top:2.5mm;inset-inline-start:2.5mm;padding:0.6mm 1.8mm;border-radius:1mm;
  background:rgba(255,248,238,0.92);color:var(--walnut);font-size:6.5pt;font-weight:600;letter-spacing:0.02em;}
.body{flex:1;display:flex;flex-direction:column;gap:1.2mm;padding:3mm 3.5mm 3.2mm;min-height:0;}
.s-ivory .body{padding:3mm 0 0;border-top:0.5pt solid var(--rule);margin-top:2.5mm;}
.name{font-family:var(--display);font-weight:600;line-height:1.2;color:var(--ink);
  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;}
.c2 .name{font-size:12.5pt;}
.c3 .name{font-size:10.5pt;}
.meta{font-size:7.5pt;line-height:1.35;color:var(--muted);display:-webkit-box;-webkit-box-orient:vertical;
  -webkit-line-clamp:2;overflow:hidden;}
.swatches{display:flex;flex-wrap:wrap;gap:1mm 2.4mm;max-height:8mm;overflow:hidden;font-size:7pt;color:var(--muted);}
.sw{display:inline-flex;align-items:center;gap:1mm;white-space:nowrap;}
.dot{display:inline-block;width:2.8mm;height:2.8mm;border-radius:50%;border:0.5pt solid rgba(43,26,18,0.25);flex:none;}
.dot.multi{background:repeating-linear-gradient(135deg,var(--chinar) 0 0.6mm,var(--saffron) 0.6mm 1.2mm,var(--teal) 1.2mm 1.8mm,var(--rose) 1.8mm 2.4mm);}
.c3 .sw .lbl{display:none;}
.c3 .sw.counted .lbl{display:inline;}
.foot-row{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:2mm;}
.rate{font-family:var(--display);font-weight:700;color:var(--accent);white-space:nowrap;}
.c2 .rate{font-size:14pt;}
.c3 .rate{font-size:11.5pt;}
.s-ivory .rate{font-weight:600;color:var(--walnut);}
.special{font-size:7.5pt;font-weight:600;color:var(--accent);margin-top:1mm;letter-spacing:0.02em;}

/* Availability: always text + marker + colour, never colour alone. */
.tag{display:inline-flex;align-items:center;gap:1.2mm;font-size:7pt;font-weight:600;white-space:nowrap;
  padding:0.8mm 2mm;border-radius:10mm;}
.tag::before{content:"";width:1.6mm;height:1.6mm;border-radius:50%;background:currentColor;}
.tag.available{color:var(--meadow);background:rgba(35,121,74,0.09);}
.tag.few{color:var(--low);background:rgba(244,163,0,0.18);}
.tag.count{color:var(--teal);background:rgba(11,110,119,0.09);}
.tag.sold_out{color:var(--chinar);background:transparent;border:0.6pt solid var(--chinar);}
.s-ivory .tag{background:transparent;padding-inline:0;}

/* Cover. */
.cover .frame{position:absolute;inset:9mm 9mm 16mm;}
.cover .frame svg{width:100%;height:100%;}
.cover .inner{position:absolute;inset:34mm 30mm 34mm;display:flex;flex-direction:column;align-items:center;
  text-align:center;}
.cover .dateline{font-size:8.5pt;color:var(--muted);}
.cover .shopname{margin-top:auto;font-family:var(--display);font-weight:700;font-size:44pt;line-height:1.05;
  color:var(--chinar);letter-spacing:-0.01em;max-width:140mm;overflow-wrap:anywhere;}
.cover .divider{width:92mm;height:11mm;margin:6mm 0 5mm;}
.cover .divider svg{width:100%;height:100%;}
.cover .collection{font-family:var(--display);font-weight:600;font-size:20pt;line-height:1.2;color:var(--walnut);
  max-width:130mm;}
.cover .count{margin-top:2mm;font-size:9pt;color:var(--muted);}
.cover .for{margin-top:12mm;font-family:var(--display);font-weight:600;font-size:13pt;color:var(--teal);}
.cover .note{margin-top:3mm;max-width:118mm;font-size:10pt;line-height:1.55;color:var(--walnut);}
.cover .terms{margin-top:6mm;display:flex;flex-wrap:wrap;justify-content:center;gap:2mm 3mm;font-size:8.5pt;}
.cover .terms span{padding:1mm 3mm;border-radius:10mm;border:0.6pt solid var(--teal);color:var(--teal);}
.cover .seller{margin-top:auto;font-size:9pt;line-height:1.5;}
.cover .seller strong{font-weight:700;}
.cover .seller .addr{color:var(--muted);font-size:8pt;max-width:120mm;}

.s-ivory .cover .corner{position:absolute;width:30mm;height:30mm;opacity:0.85;}
.s-ivory .cover .corner svg{width:100%;height:100%;}
.s-ivory .cover .tl{top:12mm;inset-inline-start:12mm;}
.s-ivory .cover .tr{top:12mm;inset-inline-end:12mm;transform:scaleX(-1);}
.s-ivory .cover .bl{bottom:16mm;inset-inline-start:12mm;transform:scaleY(-1);}
.s-ivory .cover .br{bottom:16mm;inset-inline-end:12mm;transform:scale(-1,-1);}
.s-ivory .cover .inner{inset:58mm 34mm 50mm;align-items:flex-start;text-align:start;}
.s-ivory .cover .shopname{margin-top:0;font-weight:600;font-size:40pt;color:var(--walnut);}
.s-ivory .cover .rule{width:36mm;height:0;border-top:0.75pt solid var(--walnut);margin:8mm 0 6mm;}
.s-ivory .cover .collection{font-size:18pt;font-weight:600;}
.s-ivory .cover .for{color:var(--walnut);margin-top:18mm;}
.s-ivory .cover .terms{justify-content:flex-start;}
.s-ivory .cover .terms span{border-color:var(--rule);color:var(--muted);}

/* Last page: how to order. */
.order .inner{position:absolute;inset:26mm 22mm 26mm;display:flex;flex-direction:column;}
.order h2{font-size:28pt;color:var(--accent);}
.s-ivory .order h2{font-weight:600;}
.order .lead{margin-top:2mm;font-size:9.5pt;color:var(--muted);max-width:130mm;}
.order ol{list-style:none;margin:9mm 0 0;padding:0;display:flex;flex-direction:column;gap:5mm;}
.order li{display:flex;gap:5mm;align-items:baseline;font-size:11pt;line-height:1.5;max-width:140mm;}
.order .step{font-family:var(--display);font-weight:700;font-size:20pt;line-height:1;color:var(--saffron);
  min-width:9mm;}
.s-ivory .order .step{color:var(--muted);font-weight:600;}
.contact{margin-top:11mm;display:grid;grid-template-columns:auto 1fr;gap:3.5mm 8mm;padding:6mm 7mm;
  background:var(--sand);border-radius:3mm;max-width:150mm;}
.s-ivory .contact{background:transparent;border-top:0.5pt solid var(--rule);border-bottom:0.5pt solid var(--rule);
  border-radius:0;padding-inline:0;}
.contact dt{font-size:8pt;color:var(--muted);padding-top:0.8mm;}
.contact dd{margin:0;font-size:11pt;font-weight:600;}
.contact dd.addr{font-weight:400;font-size:10pt;line-height:1.5;}
.order .valid{margin-top:7mm;font-size:9.5pt;}
.order .valid p+p{margin-top:1.5mm;}
.thanks{margin-top:auto;display:flex;flex-direction:column;align-items:center;text-align:center;gap:3mm;}
.thanks .vine{width:80mm;height:10mm;}
.thanks .vine svg{width:100%;height:100%;}
.thanks p{font-family:var(--display);font-weight:600;font-size:17pt;line-height:1.3;color:var(--walnut);max-width:140mm;}
.thanks .sign{font-family:var(--text);font-weight:400;font-size:9pt;color:var(--muted);}
`;
