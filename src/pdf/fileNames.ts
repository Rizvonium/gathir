/** Friendly, filesystem-safe names for exported PDFs ("Catalogue - Kashmir Looms - 22 Nov 2026.pdf"). */
import { formatDate } from '@/lib/dates';

import { pdfT } from './strings';

const MAX_BASE_LENGTH = 100;

/**
 * Makes a string safe as a file name on Android and in WhatsApp: removes path separators,
 * reserved characters and control characters, collapses spaces, trims dots/spaces at the ends,
 * caps the length, and never returns an empty string.
 */
export function sanitizeFileName(name: string, fallback = 'Document'): string {
  const cleaned = name
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s-]+|[.\s]+$/g, '');
  const capped = Array.from(cleaned).slice(0, MAX_BASE_LENGTH).join('').trim();
  return capped || fallback;
}

/** "Catalogue - <Shop> - 22 Nov 2026" (+ " - Part 1 of 2"), sanitised, without extension. */
export function catalogueFileBaseName(shopName: string, at: number, part?: { index: number; total: number } | null): string {
  const t = pdfT('catalogue');
  let base = t('fileName.base', { shop: shopName.trim(), date: formatDate(at) });
  if (part && part.total > 1) base += ` - ${t('fileName.part', { index: part.index, total: part.total })}`;
  return sanitizeFileName(base, 'Catalogue');
}

/** "Sales report 12 - <Shop> - 22 Nov 2026", sanitised, without extension. */
export function ownerReportFileBaseName(shopName: string, reportNumber: number, at: number): string {
  return sanitizeFileName(pdfT('report')('fileName.report', { number: reportNumber, shop: shopName.trim(), date: formatDate(at) }), 'Sales report');
}

/** "Bill B-2026-0007 - <Shop>", sanitised, without extension. */
export function billFileBaseName(billNo: string, shopName: string): string {
  return sanitizeFileName(pdfT('report')('fileName.bill', { no: billNo, shop: shopName.trim() }), 'Bill');
}

/** "<Product> - <Shop>" for product card images, sanitised, without extension. */
export function productCardFileBaseName(productName: string, shopName: string): string {
  return sanitizeFileName(pdfT('report')('fileName.card', { name: productName.trim(), shop: shopName.trim() }), 'Product');
}
