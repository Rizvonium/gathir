/**
 * Owner sales report PDF (PLAN §7). Sections, in order:
 * 1 summary · 2 every sale (photo + who bought) · 3 customers this period ·
 * 4 stock changes not from sales · 5 current stock snapshot (low / sold out highlighted) ·
 * 6 footer with app version, fingerprint and report number.
 */
import type { TFunction } from 'i18next';

import { formatDate, formatTime } from '@/lib/dates';
import { formatINR, formatNumber } from '@/lib/money';
import { formatPhoneInternational } from '@/lib/phone';

import { escapeHtml, joinParts } from '../html';
import { hashSeed, patternPalettes, sozniVineSvg } from '../patterns';
import { pdfDir, pdfLang, pdfT } from '../strings';
import { htmlDocument } from '../styles/base';
import { ownerReportCss } from '../styles/report';
import type { OwnerCustomerDoc, OwnerReportDoc, OwnerSaleDoc } from '../types';
import { colourDot, photoOrPlaceholder } from './fragments';

const e = escapeHtml;
const money = (paise: number) => e(formatINR(paise));
const num = (n: number) => e(formatNumber(n));
const when = (ms: number) => `${formatDate(ms)}, ${formatTime(ms)}`;

function customerLines(c: OwnerCustomerDoc | null, t: TFunction): string {
  if (!c) return `<span class="name">${e(t('sales.walkIn'))}</span>`;
  const extra = joinParts([c.phone ? formatPhoneInternational(c.phone) : null, c.city, c.tag ? t(`tags.${c.tag}`) : null]);
  return `<span class="name">${e(c.name)}</span>${extra ? `<br><span class="num">${e(extra)}</span>` : ''}`;
}

function masthead(doc: OwnerReportDoc, t: TFunction): string {
  const period = t('header.period', { from: formatDate(doc.period.from), to: formatDate(doc.period.to) });
  const seller = joinParts([doc.shop.sellerName, doc.shop.phone ? formatPhoneInternational(doc.shop.phone) : null]);
  return (
    `<header class="masthead"><div><h1 class="shop">${e(doc.shop.shopName)}</h1>` +
    `<p class="kind">${e(t('header.title'))}</p></div>` +
    `<div class="facts num"><strong>${e(t('header.number', { number: doc.reportNumber }))}</strong><br>${e(period)}<br>` +
    (seller ? `${e(seller)}<br>` : '') +
    `${e(t('header.generated', { date: formatDate(doc.generatedAt), time: formatTime(doc.generatedAt) }))}</div></header>` +
    `<div class="vine">${sozniVineSvg({ seed: hashSeed(doc.shop.shopName), width: 640, height: 22, palette: patternPalettes.bazaar })}</div>`
  );
}

function summarySection(doc: OwnerReportDoc, t: TFunction): string {
  const s = doc.summary;
  const stat = (label: string, value: string, cls = '') =>
    `<div class="stat ${cls}"><div class="label">${e(label)}</div><div class="value num">${value}</div></div>`;
  const payments = s.byPayment
    .filter((p) => p.count > 0)
    .map((p) => `<tr><td>${e(t(`payment.${p.method}`))}</td><td class="r num">${num(p.count)}</td><td class="r num">${money(p.amountPaise)}</td></tr>`)
    .join('');
  const categories = s.byCategory
    .map(
      (c) =>
        `<tr><td>${e(c.name ?? t('summary.uncategorised'))}</td><td class="r num">${num(c.pieces)}</td><td class="r num">${money(c.amountPaise)}</td></tr>`,
    )
    .join('');
  const returns = doc.returns.length
    ? `<h3>${e(t('summary.returns'))}</h3><table><tbody>${doc.returns
        .map(
          (r) =>
            `<tr><td class="num">${e(r.billNo)}</td><td class="num">${e(when(r.createdAt))}</td><td class="num">${e(t('summary.cancelledOn', { date: formatDate(r.cancelledAt) }))}</td><td class="r num">${money(r.totalPaise)}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '';
  const head = (first: string) =>
    `<thead><tr><th>${e(first)}</th><th class="r">${e(t('summary.colBills'))}</th><th class="r">${e(t('summary.colAmount'))}</th></tr></thead>`;
  const catHead = `<thead><tr><th>${e(t('summary.byCategory'))}</th><th class="r">${e(t('summary.colPieces'))}</th><th class="r">${e(t('summary.colAmount'))}</th></tr></thead>`;
  return (
    `<section><h2>${e(t('summary.title'))}</h2><div class="stats">` +
    stat(t('summary.pieces'), num(s.pieces)) +
    stat(t('summary.amount'), money(s.amountPaise), 'amount') +
    stat(t('summary.bills'), num(s.saleCount)) +
    stat(t('summary.discounts'), money(s.discountsPaise)) +
    `</div>` +
    (s.saleCount === 0
      ? `<p class="empty spaced">${e(t('summary.noSales'))}</p>`
      : `<div class="split"><table>${head(t('summary.byPayment'))}<tbody>${payments}</tbody></table>` +
        `<table>${catHead}<tbody>${categories}</tbody></table></div>`) +
    returns +
    `</section>`
  );
}

function saleBlock(sale: OwnerSaleDoc, t: TFunction): string {
  const rows = sale.items
    .map(
      (i) =>
        `<tr><td class="thumb-cell"><div class="thumb">${photoOrPlaceholder({ dataUri: i.photoDataUri, name: i.productName, seedKey: i.productCode || i.productName })}</div></td>` +
        `<td><span class="item-name">${e(i.productName)}</span><br><span class="code">${e(i.productCode)}</span></td>` +
        `<td><span class="sw">${colourDot(i.colourHex)}${e(i.colourName)}</span></td>` +
        `<td class="r num">${num(i.qty)}</td><td class="r num">${money(i.ratePaise)}</td><td class="r num amt">${money(i.amountPaise)}</td></tr>`,
    )
    .join('');
  return (
    `<article class="sale"><div class="sale-head"><div><span class="when num">${e(when(sale.createdAt))}</span><br>` +
    `<span class="bill num">${e(joinParts([t('sales.bill', { no: sale.billNo }), t(`payment.${sale.payment}`)]))}</span></div>` +
    `<div class="who">${customerLines(sale.customer, t)}</div></div>` +
    `<table><thead><tr><th></th><th>${e(t('sales.colItem'))}</th><th>${e(t('sales.colColour'))}</th><th class="r">${e(t('sales.colQty'))}</th>` +
    `<th class="r">${e(t('sales.colRate'))}</th><th class="r">${e(t('sales.colAmount'))}</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<div class="sale-foot num">` +
    (sale.discountPaise > 0 ? `<span>${e(t('sales.discount', { amount: formatINR(sale.discountPaise) }))}</span>` : '') +
    `<span class="total">${e(t('sales.total', { amount: formatINR(sale.totalPaise) }))}</span></div>` +
    (sale.note.trim() ? `<p class="sale-note">${e(sale.note)}</p>` : '') +
    `</article>`
  );
}

function salesSection(doc: OwnerReportDoc, t: TFunction): string {
  const body = doc.sales.length ? doc.sales.map((s) => saleBlock(s, t)).join('') : `<p class="empty">${e(t('summary.noSales'))}</p>`;
  return `<section><h2>${e(t('sales.title'))}</h2>${body}</section>`;
}

function customersSection(doc: OwnerReportDoc, t: TFunction): string {
  const c = doc.customers;
  const contact = (x: OwnerCustomerDoc) =>
    e(joinParts([x.phone ? formatPhoneInternational(x.phone) : null, x.city, x.tag ? t(`tags.${x.tag}`) : null]));
  const newRows = c.newCustomers.map((x) => `<tr><td class="item-name">${e(x.name)}</td><td class="num">${contact(x)}</td></tr>`).join('');
  const topRows = c.topBySpend
    .map(
      (x) =>
        `<tr><td class="item-name">${e(x.name)}</td><td class="num">${contact(x)}</td>` +
        `<td class="r num">${e(t('customers.purchases', { count: x.purchases, n: formatNumber(x.purchases) }))}</td><td class="r num amt">${money(x.spendPaise)}</td></tr>`,
    )
    .join('');
  const none = `<p class="empty">${e(t('customers.none'))}</p>`;
  return (
    `<section><h2>${e(t('customers.title'))}</h2>` +
    `<h3>${e(t('customers.new', { n: formatNumber(c.newCustomers.length) }))}</h3>` +
    (newRows ? `<table><tbody>${newRows}</tbody></table>` : none) +
    `<h3>${e(t('customers.top'))}</h3>` +
    (topRows ? `<table><tbody>${topRows}</tbody></table>` : none) +
    `<h3>${e(t('customers.catalogues', { n: formatNumber(c.cataloguesSent) }))}</h3></section>`
  );
}

function changesSection(doc: OwnerReportDoc, t: TFunction): string {
  if (doc.stockChanges.length === 0) {
    return `<section><h2>${e(t('changes.title'))}</h2><p class="empty">${e(t('changes.none'))}</p></section>`;
  }
  const rows = doc.stockChanges
    .map((c) => {
      const delta = c.delta > 0 ? `<span class="plus">+${num(c.delta)}</span>` : `<span class="minus">−${num(Math.abs(c.delta))}</span>`;
      return (
        `<tr><td class="num">${e(when(c.at))}</td><td><span class="item-name">${e(c.productName)}</span><br><span class="code">${e(c.productCode)}</span></td>` +
        `<td>${e(c.colourName)}</td><td class="r num">${delta}</td><td>${e(t(`reasons.${c.reason}`))}</td><td>${e(c.note)}</td></tr>`
      );
    })
    .join('');
  return (
    `<section><h2>${e(t('changes.title'))}</h2><p class="empty lead">${e(t('changes.intro'))}</p>` +
    `<table><thead><tr><th>${e(t('changes.colWhen'))}</th><th>${e(t('changes.colDesign'))}</th><th>${e(t('changes.colColour'))}</th>` +
    `<th class="r">${e(t('changes.colChange'))}</th><th>${e(t('changes.colReason'))}</th><th>${e(t('changes.colNote'))}</th></tr></thead>` +
    `<tbody>${rows}</tbody></table></section>`
  );
}

function stockSection(doc: OwnerReportDoc, t: TFunction): string {
  const tot = doc.totals;
  const rows = doc.stock
    .map((r) => {
      const colours = r.colours.map((c) => `<span class="sw">${colourDot(c.hex)}${e(c.name)} <span class="num">${num(c.pieces)}</span></span>`).join(' ');
      return (
        `<tr class="${r.status}"><td class="thumb-cell"><div class="thumb">${photoOrPlaceholder({ dataUri: r.photoDataUri, name: r.name, seedKey: r.code || r.name })}</div></td>` +
        `<td><span class="item-name">${e(r.name)}</span><br><span class="code">${e(joinParts([r.code, r.craft, r.categoryName]))}</span></td>` +
        `<td>${colours}</td><td class="r num amt">${num(r.totalPieces)}</td><td class="r num">${money(r.ratePaise)}</td>` +
        `<td><span class="status ${r.status}">${e(t(`stock.status.${r.status}`))}</span></td></tr>`
      );
    })
    .join('');
  const totals = t('stock.totals', {
    pieces: formatNumber(tot.totalPieces),
    designs: formatNumber(tot.designs),
    low: formatNumber(tot.lowCount),
    out: formatNumber(tot.outCount),
  });
  return (
    `<section><h2>${e(t('stock.title'))}</h2><p class="num lead">${e(totals)}</p>` +
    (rows
      ? `<table><thead><tr><th></th><th>${e(t('stock.colDesign'))}</th><th>${e(t('stock.colColours'))}</th><th class="r">${e(t('stock.colPieces'))}</th>` +
        `<th class="r">${e(t('stock.colRate'))}</th><th>${e(t('stock.colStatus'))}</th></tr></thead><tbody>${rows}</tbody>` +
        `<tfoot><tr><td></td><td colspan="2">${e(t('stock.value'))}</td><td class="r num">${num(tot.totalPieces)}</td><td class="r num">${money(tot.stockValuePaise)}</td><td></td></tr></tfoot></table>`
      : `<p class="empty">${e(t('stock.none'))}</p>`) +
    `</section>`
  );
}

function docFooter(doc: OwnerReportDoc, t: TFunction): string {
  return (
    `<footer class="doc-foot num"><span>${e(t('footer.app', { version: doc.appVersion }))}</span>` +
    `<span>${e(t('footer.report', { number: doc.reportNumber }))}</span>` +
    `<span>${e(t('footer.fingerprint'))} <span class="fp">${e(doc.fingerprint)}</span></span>` +
    `<span>${e(t('footer.verify'))}</span></footer>`
  );
}

/** Renders the owner's sales report as one HTML document for expo-print (A4). */
export function renderOwnerReportHtml(doc: OwnerReportDoc): string {
  const t = pdfT('report');
  const body =
    masthead(doc, t) +
    summarySection(doc, t) +
    salesSection(doc, t) +
    customersSection(doc, t) +
    changesSection(doc, t) +
    stockSection(doc, t) +
    docFooter(doc, t);
  return htmlDocument({
    lang: pdfLang(),
    dir: pdfDir(),
    title: e(t('docTitle', { number: doc.reportNumber, shop: doc.shop.shopName })),
    fontCss: doc.fontCss,
    css: ownerReportCss,
    body,
  });
}
