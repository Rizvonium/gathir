/**
 * Sale bill (PLAN §4.6 "Send bill", §4.7). One A5 page in a single narrow column, so it also
 * reads well when a customer zooms it on a phone or prints it on an 80 mm receipt printer.
 */
import { formatDate, formatTime } from '@/lib/dates';
import { formatINR, formatNumber } from '@/lib/money';
import { formatPhoneInternational } from '@/lib/phone';

import { escapeHtml, escapeMultiline, joinParts } from '../html';
import { hashSeed, patternPalettes, sozniVineSvg } from '../patterns';
import { pdfDir, pdfLang, pdfT } from '../strings';
import { htmlDocument } from '../styles/base';
import { billCss } from '../styles/bill';
import type { BillDoc } from '../types';

const e = escapeHtml;

/** Renders a single-page bill as HTML for expo-print (use BILL_PAGE for the paper size). */
export function renderBillHtml(doc: BillDoc): string {
  const t = pdfT('report');
  const shop = doc.shop;
  const contact = joinParts([shop.phone ? formatPhoneInternational(shop.phone) : null]);
  const customer = doc.customer
    ? `<strong>${e(doc.customer.name)}</strong>${doc.customer.phone ? `<br><span class="num">${e(formatPhoneInternational(doc.customer.phone))}</span>` : ''}`
    : e(t('bill.walkIn'));

  const rows = doc.items
    .map(
      (i) =>
        `<tr><td><span class="item">${e(i.name)}</span><br><span class="sub">${e(joinParts([i.colourName, i.code]))}</span></td>` +
        `<td class="r num">${e(formatNumber(i.qty))} × ${e(formatINR(i.ratePaise))}</td><td class="r num amt">${e(formatINR(i.amountPaise))}</td></tr>`,
    )
    .join('');

  const totals =
    (doc.discountPaise > 0
      ? `<tr><td>${e(t('bill.subtotal'))}</td><td class="r num">${e(formatINR(doc.subtotalPaise))}</td></tr>` +
        `<tr><td>${e(t('bill.discount'))}</td><td class="r num">−${e(formatINR(doc.discountPaise))}</td></tr>`
      : '') +
    `<tr class="grand"><td>${e(t('bill.total'))}</td><td class="r num">${e(formatINR(doc.totalPaise))}</td></tr>`;

  const body =
    `<main class="bill">` +
    (doc.cancelled ? `<p class="stamp">${e(t('bill.cancelled'))}</p>` : '') +
    `<header><h1>${e(shop.shopName)}</h1>` +
    (shop.address.trim() ? `<p class="addr">${escapeMultiline(shop.address)}</p>` : '') +
    (contact ? `<p class="num">${e(contact)}</p>` : '') +
    `</header>` +
    `<div class="vine">${sozniVineSvg({ seed: hashSeed(shop.shopName), width: 360, height: 18, palette: patternPalettes.bazaar })}</div>` +
    `<dl class="facts"><div><dt>${e(t('bill.billNo'))}</dt><dd class="num">${e(doc.billNo)}</dd></div>` +
    `<div><dt>${e(t('bill.date'))}</dt><dd class="num">${e(`${formatDate(doc.createdAt)}, ${formatTime(doc.createdAt)}`)}</dd></div>` +
    `<div class="wide"><dt>${e(t('bill.customer'))}</dt><dd>${customer}</dd></div></dl>` +
    `<table class="items"><thead><tr><th>${e(t('bill.colItem'))}</th><th class="r">${e(t('bill.colQtyRate'))}</th><th class="r">${e(t('bill.colAmount'))}</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>` +
    `<table class="totals"><tbody>${totals}</tbody></table>` +
    `<p class="paid">${e(t('bill.paidBy', { method: t(`payment.${doc.payment}`) }))}</p>` +
    (doc.note?.trim() ? `<p class="note">${escapeMultiline(doc.note)}</p>` : '') +
    (shop.upiId.trim() ? `<p class="upi">${e(t('bill.upi', { upi: shop.upiId.trim() }))}</p>` : '') +
    `<p class="thanks">${e(t('bill.thanks'))}</p>` +
    `</main>`;

  return htmlDocument({
    lang: pdfLang(),
    dir: pdfDir(),
    title: e(t('bill.docTitle', { no: doc.billNo, shop: shop.shopName })),
    fontCss: doc.fontCss,
    css: billCss,
    body,
  });
}
