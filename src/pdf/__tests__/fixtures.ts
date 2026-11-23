/** Sample docs for PDF template tests. */
import type { BillDoc, CatalogueDoc, CatalogueItemDoc, OwnerReportDoc, PdfShop } from '../types';

export const NOW = new Date(2026, 10, 22, 16, 5).getTime();
export const TINY_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDA==';

export const shop: PdfShop = {
  shopName: 'Kashmir Looms',
  sellerName: 'Bilal Ahmad',
  phone: '+919876543210',
  address: 'Polo View, Srinagar',
  upiId: 'kashmirlooms@upi',
};

export function item(over: Partial<CatalogueItemDoc> = {}): CatalogueItemDoc {
  return {
    id: 'p1',
    code: 'GTH-0001',
    name: 'Sozni Stole',
    craft: 'Sozni',
    material: 'Pashmina',
    size: '70×200 cm',
    ratePaise: 650000,
    totalPieces: null,
    availability: { kind: 'available' },
    colours: [
      { name: 'Red', hex: '#C0262D', pieces: null },
      { name: 'Multicolour', hex: 'multi', pieces: null },
    ],
    photoDataUri: TINY_JPEG,
    ...over,
  };
}

export function catalogue(over: Partial<CatalogueDoc> = {}): CatalogueDoc {
  return {
    shop,
    title: 'Winter Collection',
    generatedAt: NOW,
    options: { showRates: true, showOnlyLeft: true, showExactCounts: false, hideSoldOut: true, style: 'bazaar', columns: 2 },
    items: [
      item(),
      item({ id: 'p2', code: 'GTH-0002', name: 'Kani Shawl', ratePaise: 12500000, availability: { kind: 'few', count: 2 }, photoDataUri: null }),
      item({ id: 'p3', code: 'GTH-0003', name: 'Aari Wrap', availability: { kind: 'sold_out' } }),
    ],
    customerName: 'Mrs. Shah',
    ratesValidTill: new Date(2026, 10, 30).getTime(),
    ...over,
  };
}

export function ownerReport(over: Partial<OwnerReportDoc> = {}): OwnerReportDoc {
  return {
    shop,
    period: { from: new Date(2026, 10, 15).getTime(), to: NOW },
    generatedAt: NOW,
    reportNumber: 12,
    appVersion: '1.0.0',
    fingerprint: 'A1B2-C3D4',
    summary: {
      pieces: 7,
      amountPaise: 4850000,
      saleCount: 5,
      discountsPaise: 50000,
      byPayment: [
        { method: 'cash', count: 2, amountPaise: 1850000 },
        { method: 'upi', count: 3, amountPaise: 3000000 },
        { method: 'card', count: 0, amountPaise: 0 },
        { method: 'other', count: 0, amountPaise: 0 },
      ],
      byCategory: [
        { name: 'Stoles', pieces: 4, amountPaise: 2600000 },
        { name: null, pieces: 3, amountPaise: 2300000 },
      ],
    },
    sales: [
      {
        billNo: 'B-2026-0007',
        createdAt: NOW,
        payment: 'upi',
        discountPaise: 50000,
        totalPaise: 1250000,
        note: '',
        customer: { name: 'Mrs. <b>Shah</b>', phone: '+919811112222', city: 'Delhi', tag: 'regular' },
        items: [
          { productName: 'Sozni Stole', productCode: 'GTH-0001', colourName: 'Red', colourHex: '#C0262D', qty: 2, ratePaise: 650000, amountPaise: 1300000, photoDataUri: TINY_JPEG },
        ],
      },
    ],
    returns: [],
    earlierReturnsPaise: 0,
    customers: {
      newCustomers: [{ name: 'Mrs. <b>Shah</b>', phone: '+919811112222', city: 'Delhi', tag: 'regular' }],
      topBySpend: [{ name: 'Mrs. <b>Shah</b>', phone: null, city: 'Delhi', tag: null, spendPaise: 1250000, purchases: 1 }],
      cataloguesSent: 3,
    },
    stockChanges: [
      { at: NOW, productName: 'Kani Shawl', productCode: 'GTH-0002', colourName: 'Beige', delta: -1, reason: 'damaged', note: 'Moth hole' },
    ],
    stock: [
      { code: 'GTH-0001', name: 'Sozni Stole', craft: 'Sozni', categoryName: 'Stoles', ratePaise: 650000, totalPieces: 2, status: 'low', photoDataUri: null, colours: [{ name: 'Red', hex: '#C0262D', pieces: 2 }] },
      { code: 'GTH-0002', name: 'Kani Shawl', craft: 'Kani', categoryName: null, ratePaise: 12500000, totalPieces: 0, status: 'out', photoDataUri: null, colours: [] },
    ],
    totals: { totalPieces: 63, designs: 21, stockValuePaise: 98000000, lowCount: 3, outCount: 1 },
    ...over,
  };
}

export function bill(over: Partial<BillDoc> = {}): BillDoc {
  return {
    shop,
    billNo: 'B-2026-0007',
    createdAt: NOW,
    customer: { name: 'Mrs. Shah', phone: '+919811112222' },
    items: [{ name: 'Sozni Stole', code: 'GTH-0001', colourName: 'Red', qty: 2, ratePaise: 650000, amountPaise: 1300000 }],
    subtotalPaise: 1300000,
    discountPaise: 50000,
    totalPaise: 1250000,
    payment: 'upi',
    ...over,
  };
}
