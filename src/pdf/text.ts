/**
 * Pre-filled WhatsApp texts that travel with each PDF. Plain text (WhatsApp does not render HTML),
 * so nothing is escaped here; line breaks are "\n".
 */
import { formatDate } from '@/lib/dates';
import { formatINR, formatNumber } from '@/lib/money';

import { visibleCatalogueItems } from './paginate';
import { pdfT, shareT } from './strings';
import type { BillDoc, CatalogueDoc, OwnerReportDoc } from './types';

const plural = (count: number) => ({ count, n: formatNumber(count) });

/**
 * The owner report message, exactly as PLAN §7:
 * Gathir report — <Shop> (<Seller>) / <From> – <To> / Sold: … · ₹… / In stock: … / PDF attached.
 */
export function ownerReportMessage(doc: OwnerReportDoc): string {
  const t = shareT('report');
  const shop = doc.shop.shopName.trim();
  const seller = doc.shop.sellerName.trim();
  return [
    seller ? t('report.title', { shop, seller }) : t('report.titleNoSeller', { shop }),
    t('report.period', { from: formatDate(doc.period.from), to: formatDate(doc.period.to) }),
    t('report.sold', { pieces: t('report.pieces', plural(doc.summary.pieces)), amount: formatINR(doc.summary.amountPaise) }),
    t('report.inStock', {
      pieces: t('report.pieces', plural(doc.totals.totalPieces)),
      designs: t('report.designs', plural(doc.totals.designs)),
      low: formatNumber(doc.totals.lowCount),
    }),
    t('report.attached'),
  ].join('\n');
}

/** Short, warm message to a customer with the catalogue PDF. Never mentions rates or counts. */
export function catalogueMessage(doc: CatalogueDoc): string {
  const t = shareT('catalogue');
  const name = doc.customerName?.trim();
  const count = visibleCatalogueItems(doc.items, doc.options).length;
  const lines = [
    name ? t('message.greeting', { name }) : t('message.greetingNoName'),
    t('message.intro', { ...plural(count), title: doc.title.trim() || t('message.defaultTitle'), shop: doc.shop.shopName.trim() }),
  ];
  if (doc.part && doc.part.total > 1) lines.push(t('message.part', { index: doc.part.index, total: doc.part.total }));
  if (doc.ratesValidTill && doc.options.showRates) lines.push(t('message.ratesValidTill', { date: formatDate(doc.ratesValidTill) }));
  if (doc.discountLine?.trim()) lines.push(doc.discountLine.trim());
  lines.push(t('message.outro'));
  return lines.join('\n');
}

/** Message sent with a bill PDF: bill number, date, amount and payment, UPI ID when set. */
export function billMessage(doc: BillDoc): string {
  const t = shareT('report');
  const payment = pdfT('report')(`payment.${doc.payment}`);
  const lines = [
    t('bill.title', { no: doc.billNo, shop: doc.shop.shopName.trim() }),
    t('bill.line', { date: formatDate(doc.createdAt), amount: formatINR(doc.totalPaise), payment }),
  ];
  if (doc.shop.upiId.trim()) lines.push(t('bill.upi', { upi: doc.shop.upiId.trim() }));
  lines.push(t('bill.thanks'));
  return lines.join('\n');
}
