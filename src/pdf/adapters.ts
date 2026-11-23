/**
 * Maps the data layer's view models (src/db/repo/reports.ts) to PDF template docs.
 * Photos are loaded through an injected loader (normally photoAsDataUri from src/lib/photos.ts)
 * so this module stays testable in Node and does not depend on expo modules.
 */
import type { ProfitGroupRow } from '@/db/repo/profit';
import type { CatalogueData, OwnerReportData } from '@/db/repo/reports';
import type { SaleDetail } from '@/db/repo/saleQueries';
import type { ShopInfo } from '@/db/repo/shopInfo';

import type { BillDoc, CatalogueDoc, CatalogueDocOptions, OwnerProfitRowDoc, OwnerReportDoc, PdfShop } from './types';

/** (fileName, maxSide?, quality?) → data URI, or null when missing. Matches photoAsDataUri. */
export type PhotoLoader = (fileName: string, maxSide?: number, quality?: number) => Promise<string | null>;

/** Catalogue photos: ~800 px, JPEG 0.72 (PLAN §6 size budget). Report thumbnails are smaller. */
export const CATALOGUE_PHOTO = { maxSide: 800, quality: 0.72 } as const;
export const REPORT_THUMB = { maxSide: 240, quality: 0.7 } as const;

/** Loads many photos (deduplicated, a few at a time). Missing/failed photos are simply absent. */
export async function loadPhotoMap(
  fileNames: readonly (string | null | undefined)[],
  loader: PhotoLoader,
  size: { maxSide: number; quality: number },
  concurrency = 4,
): Promise<Map<string, string>> {
  const unique = [...new Set(fileNames.filter((f): f is string => !!f))];
  const out = new Map<string, string>();
  let next = 0;
  const worker = async () => {
    while (next < unique.length) {
      const name = unique[next++];
      try {
        const uri = await loader(name, size.maxSide, size.quality);
        if (uri) out.set(name, uri);
      } catch {
        // Missing photo: the template draws a pattern placeholder.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  return out;
}

/** Shop details for PDFs from the repo's ShopInfo. */
export function pdfShopFrom(shop: ShopInfo): PdfShop {
  return { shopName: shop.shopName, sellerName: shop.sellerName, phone: shop.phone, address: shop.address, upiId: shop.upiId };
}

export type CatalogueExtras = Pick<CatalogueDoc, 'title' | 'customerName' | 'personalNote' | 'ratesValidTill' | 'discountLine' | 'part' | 'fontCss'> & {
  /** Style, columns and "Only n left"; rates/counts/sold-out come from the data's own options. */
  layout: Pick<CatalogueDocOptions, 'style' | 'columns' | 'showOnlyLeft'>;
};

/** CatalogueData (+ the seller's choices) → CatalogueDoc. Photo map keys are cover file names. */
export function catalogueDocFromData(data: CatalogueData, extras: CatalogueExtras, photos: ReadonlyMap<string, string>): CatalogueDoc {
  return {
    shop: pdfShopFrom(data.shop),
    title: extras.title,
    generatedAt: data.generatedAt,
    options: {
      showRates: data.options.showRates,
      showExactCounts: data.options.showCounts,
      hideSoldOut: data.options.hideSoldOut,
      ...extras.layout,
    },
    items: data.products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      craft: p.craft,
      material: p.material,
      size: p.size,
      ratePaise: p.ratePaise,
      specialPrice: data.options.showRates && p.ratePaise !== null && p.specialPrice === true,
      totalPieces: p.totalPieces,
      availability: p.availability,
      colours: p.colours,
      photoDataUri: (p.cover && photos.get(p.cover.fileName)) ?? null,
    })),
    customerName: extras.customerName ?? data.preparedFor ?? null,
    personalNote: extras.personalNote,
    ratesValidTill: extras.ratesValidTill,
    discountLine: extras.discountLine,
    part: extras.part,
    fontCss: extras.fontCss,
  };
}

/** Cover photo file names a catalogue needs (pass to loadPhotoMap with CATALOGUE_PHOTO). */
export function cataloguePhotoNames(data: CatalogueData): string[] {
  return data.products.map((p) => p.cover?.fileName).filter((f): f is string => !!f);
}

/** Photo file names an owner report needs (sold items and stock rows; pass with REPORT_THUMB). */
export function ownerReportPhotoNames(data: OwnerReportData): string[] {
  const names: string[] = [];
  for (const s of data.sales) for (const i of s.items) if (i.photoName) names.push(i.photoName);
  for (const r of data.stock) if (r.photoName) names.push(r.photoName);
  return names;
}

/** OwnerReportData → OwnerReportDoc. */
export function ownerReportDocFromData(
  data: OwnerReportData,
  extras: { appVersion: string; fingerprint: string; fontCss?: string },
  photos: ReadonlyMap<string, string>,
): OwnerReportDoc {
  const photo = (name: string | null) => (name ? (photos.get(name) ?? null) : null);
  const s = data.summary;
  return {
    shop: pdfShopFrom(data.shop),
    period: { from: data.period.from, to: data.period.to },
    generatedAt: data.generatedAt,
    reportNumber: data.reportNumber,
    appVersion: extras.appVersion,
    fingerprint: extras.fingerprint,
    fontCss: extras.fontCss,
    summary: {
      pieces: s.pieces,
      amountPaise: s.amountPaise,
      saleCount: s.count,
      discountsPaise: s.discountsPaise,
      byPayment: (Object.keys(s.byPayment) as (keyof typeof s.byPayment)[]).map((method) => ({ method, ...s.byPayment[method] })),
      byCategory: s.byCategory.map((c) => ({ name: c.name, pieces: c.pieces, amountPaise: c.amountPaise })),
    },
    sales: data.sales.map((sale) => ({
      billNo: sale.billNo,
      createdAt: sale.createdAt,
      payment: sale.payment,
      discountPaise: sale.discountPaise,
      totalPaise: sale.totalPaise,
      note: sale.note,
      customer: sale.customer && { name: sale.customer.name, phone: sale.customer.phone, city: sale.customer.city, tag: sale.customer.tag },
      ...(data.includeProfit ? { profitPaise: sale.profitPaise ?? null } : {}),
      items: sale.items.map((i) => ({
        productName: i.productName,
        productCode: i.productCode,
        colourName: i.colourName,
        colourHex: i.colourHex,
        qty: i.qty,
        ratePaise: i.ratePaise,
        amountPaise: i.amountPaise,
        photoDataUri: photo(i.photoName),
        ...(data.includeProfit ? { costPaise: i.costPaise ?? null, profitPaise: i.profitPaise ?? null } : {}),
      })),
    })),
    returns: data.returns.map((r) => ({
      billNo: r.billNo,
      createdAt: r.createdAt,
      cancelledAt: r.cancelledAt,
      totalPaise: r.totalPaise,
      earlierSale: r.earlierSale,
    })),
    earlierReturnsPaise: data.earlierReturnsPaise,
    customers: {
      newCustomers: data.customers.newCustomers.map((c) => ({ name: c.name, phone: c.phone, city: c.city, tag: c.tag })),
      topBySpend: data.customers.topBySpend.map((c) => ({
        name: c.name,
        phone: c.phone,
        city: c.city,
        tag: c.tag,
        spendPaise: c.spendPaise,
        purchases: c.purchases,
      })),
      cataloguesSent: data.customers.cataloguesSent,
    },
    stockChanges: data.stockChanges.map((c) => ({
      at: c.at,
      productName: c.productName,
      productCode: c.productCode,
      colourName: c.colourName,
      delta: c.delta,
      reason: c.reason,
      note: c.note,
    })),
    stock: data.stock.map((r) => ({
      code: r.code,
      name: r.name,
      craft: r.craft,
      categoryName: r.categoryName,
      ratePaise: r.ratePaise,
      totalPieces: r.totalPieces,
      status: r.status,
      photoDataUri: photo(r.photoName),
      colours: r.colours,
    })),
    totals: { ...data.totals },
    profit: data.includeProfit && data.profit ? profitDoc(data.profit) : null,
  };
}

function profitRow(r: ProfitGroupRow): OwnerProfitRowDoc {
  return { label: r.label, revenuePaise: r.knownRevenuePaise, profitPaise: r.profitPaise, marginPct: r.marginPct, unknownCostItems: r.unknownCostItems };
}

function profitDoc(p: NonNullable<OwnerReportData['profit']>): NonNullable<OwnerReportDoc['profit']> {
  return {
    profitPaise: p.summary.profitPaise,
    marginPct: p.summary.marginPct,
    knownCostPaise: p.summary.knownCostPaise,
    knownRevenuePaise: p.summary.knownRevenuePaise,
    unknownCostItems: p.summary.unknownCostItems,
    byCategory: p.byCategory.map(profitRow),
    byProduct: p.byProduct.map(profitRow),
    stockValueAtCostPaise: p.stockValueAtCostPaise,
    stockCostUnknownPieces: p.stockCostUnknownPieces,
  };
}

/**
 * Sale (from getSale / useSale) → bill doc. Uses the sale's own snapshots, so a bill for a
 * deleted product or customer still prints exactly as sold.
 */
export function billDocFromSale(detail: SaleDetail, shop: ShopInfo, fontCss?: string): BillDoc {
  const { sale, items, customer } = detail;
  const lines = items.map((i) => ({
    name: i.productNameSnapshot,
    code: i.productCodeSnapshot,
    colourName: i.colourNameSnapshot,
    qty: i.qty,
    ratePaise: i.ratePaise,
    amountPaise: i.qty * i.ratePaise,
  }));
  const name = sale.customerNameSnapshot ?? customer?.name ?? null;
  return {
    shop: pdfShopFrom(shop),
    billNo: sale.billNo,
    createdAt: sale.createdAt,
    customer: name ? { name, phone: sale.customerPhoneSnapshot ?? customer?.phone ?? null } : null,
    items: lines,
    subtotalPaise: lines.reduce((sum, l) => sum + l.amountPaise, 0),
    discountPaise: sale.discountPaise,
    totalPaise: sale.totalPaise,
    payment: sale.payment,
    note: sale.note || null,
    cancelled: sale.cancelledAt != null,
    fontCss,
  };
}
