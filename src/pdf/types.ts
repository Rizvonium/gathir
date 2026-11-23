/**
 * Template input types for every PDF (and the WhatsApp texts that travel with them).
 * They are plain and complete on purpose: templates are pure functions of these values.
 * Feature code maps repo view models (src/db/repo/reports.ts) to these types — see ./adapters.ts.
 * Money is integer paise, time is epoch ms, photos are data URIs (or null for a pattern placeholder).
 */

/** Shop details printed on PDFs. Empty strings mean "not set" and are left out. */
export type PdfShop = {
  shopName: string;
  sellerName: string;
  /** E.164 or as typed; shown as the WhatsApp/phone number. */
  phone: string;
  address: string;
  upiId: string;
};

export type PaymentKey = 'cash' | 'upi' | 'card' | 'other';
export type StockReasonKey =
  | 'added'
  | 'sold'
  | 'returned'
  | 'damaged'
  | 'correction'
  | 'returned_to_owner'
  | 'sample'
  | 'deleted'
  | 'restored'
  | 'opening';
export type CustomerTagKey = 'regular' | 'wholesale' | 'tourist' | 'walk_in' | 'other';
export type StockStatusKey = 'in' | 'low' | 'out';

/* ───────────────────────── Catalogue (PLAN §6) ───────────────────────── */

export type CatalogueStyle = 'bazaar' | 'ivory';
export type CatalogueColumns = 2 | 3;

export type CatalogueDocOptions = {
  /** Default true. When false, no rate (and no "₹") appears anywhere. */
  showRates: boolean;
  /** Default true. "Only n left" for items at or under the few threshold. */
  showOnlyLeft: boolean;
  /** Default false. Exact piece counts per item and per colour. */
  showExactCounts: boolean;
  /** Default true. Sold-out items are left out. */
  hideSoldOut: boolean;
  style: CatalogueStyle;
  columns: CatalogueColumns;
};

/** Same shape as the repo's Availability: 'few' always carries the count. */
export type CatalogueAvailability = { kind: 'available' } | { kind: 'few'; count: number } | { kind: 'sold_out' };

export type CatalogueItemDoc = {
  id: string;
  code: string;
  name: string;
  craft: string;
  material: string;
  size: string;
  /** Null when rates are hidden or not set. In a personal catalogue: the customer's special rate when set. */
  ratePaise: number | null;
  /** The rate is this customer's special price (shows a small "Special price for you" tag). */
  specialPrice?: boolean;
  /** Null unless exact counts are shown. */
  totalPieces: number | null;
  availability: CatalogueAvailability;
  /** `hex` is a colour or 'multi' (drawn striped). `pieces` is null unless exact counts are shown. */
  colours: { name: string; hex: string; pieces: number | null }[];
  /** ~800 px JPEG data URI, or null for the pattern placeholder with initials. */
  photoDataUri: string | null;
};

export type CatalogueDoc = {
  shop: PdfShop;
  /** Collection title, e.g. "Winter Collection". Empty → the default title. */
  title: string;
  generatedAt: number;
  options: CatalogueDocOptions;
  items: CatalogueItemDoc[];
  /** "Prepared for <customer>" on the cover. */
  customerName?: string | null;
  personalNote?: string | null;
  /** Epoch ms; shown on the cover and the last page. */
  ratesValidTill?: number | null;
  /** Free text, e.g. "10% off on 3 or more shawls". */
  discountLine?: string | null;
  /** Set when a large catalogue is split ("Part 1 of 2"). */
  part?: { index: number; total: number } | null;
  /** @font-face CSS from getPdfFontCss(); empty → system serif/sans-serif. */
  fontCss?: string;
};

/* ───────────────────────── Owner report (PLAN §7) ───────────────────────── */

export type OwnerCustomerDoc = {
  name: string;
  /** Null when the seller chose not to include phones. */
  phone: string | null;
  city: string;
  tag: CustomerTagKey | null;
};

export type OwnerSaleItemDoc = {
  productName: string;
  productCode: string;
  colourName: string;
  colourHex: string;
  qty: number;
  ratePaise: number;
  amountPaise: number;
  photoDataUri: string | null;
  /** Only in a report with profit: buying price per piece at sale time (null = unknown). */
  costPaise?: number | null;
  /** Only in a report with profit: line profit after its share of the discount (null = unknown). */
  profitPaise?: number | null;
};

export type OwnerSaleDoc = {
  billNo: string;
  createdAt: number;
  payment: PaymentKey;
  discountPaise: number;
  totalPaise: number;
  note: string;
  customer: OwnerCustomerDoc | null;
  items: OwnerSaleItemDoc[];
  /** Only in a report with profit: the bill's profit, null when a buying price is unknown. */
  profitPaise?: number | null;
};

/** A profit row (category or design). Revenue/profit count only items with a buying price. */
export type OwnerProfitRowDoc = { label: string | null; revenuePaise: number; profitPaise: number; marginPct: number | null; unknownCostItems: number };

/** Seller's buying prices and profit. Present ONLY when the seller turned "report includes profit" on. */
export type OwnerProfitDoc = {
  profitPaise: number;
  marginPct: number | null;
  knownCostPaise: number;
  knownRevenuePaise: number;
  unknownCostItems: number;
  byCategory: OwnerProfitRowDoc[];
  byProduct: OwnerProfitRowDoc[];
  stockValueAtCostPaise: number;
  stockCostUnknownPieces: number;
};

export type OwnerStockChangeDoc = {
  at: number;
  productName: string;
  productCode: string;
  colourName: string;
  delta: number;
  reason: StockReasonKey;
  note: string;
};

export type OwnerStockRowDoc = {
  code: string;
  name: string;
  craft: string;
  categoryName: string | null;
  ratePaise: number;
  totalPieces: number;
  status: StockStatusKey;
  photoDataUri: string | null;
  colours: { name: string; hex: string; pieces: number }[];
};

export type OwnerReportDoc = {
  shop: PdfShop;
  period: { from: number; to: number };
  generatedAt: number;
  reportNumber: number;
  appVersion: string;
  /** Short checksum of the report data (computeFingerprint in the repo). */
  fingerprint: string;
  summary: {
    pieces: number;
    amountPaise: number;
    saleCount: number;
    discountsPaise: number;
    byPayment: { method: PaymentKey; count: number; amountPaise: number }[];
    byCategory: { name: string | null; pieces: number; amountPaise: number }[];
  };
  sales: OwnerSaleDoc[];
  /** `earlierSale`: made before this period (counted in an earlier report), returned during it. */
  returns: { billNo: string; createdAt: number; cancelledAt: number; totalPaise: number; earlierSale: boolean }[];
  /** Refunded in this period for sales made before it. */
  earlierReturnsPaise: number;
  customers: {
    newCustomers: OwnerCustomerDoc[];
    topBySpend: (OwnerCustomerDoc & { spendPaise: number; purchases: number })[];
    cataloguesSent: number;
  };
  stockChanges: OwnerStockChangeDoc[];
  stock: OwnerStockRowDoc[];
  totals: { totalPieces: number; designs: number; stockValuePaise: number; lowCount: number; outCount: number };
  /** Null/absent unless the seller chose to include buying prices and profit. */
  profit?: OwnerProfitDoc | null;
  fontCss?: string;
};

/* ───────────────────────── Bill (PLAN §4.6 / §4.7) ───────────────────────── */

export type BillDoc = {
  shop: PdfShop;
  billNo: string;
  createdAt: number;
  customer: { name: string; phone: string | null } | null;
  items: { name: string; code: string; colourName: string; qty: number; ratePaise: number; amountPaise: number }[];
  /** Sum of item amounts before the bill discount. */
  subtotalPaise: number;
  discountPaise: number;
  totalPaise: number;
  payment: PaymentKey;
  note?: string | null;
  /** True when the sale was later returned/cancelled: the bill is stamped "Cancelled". */
  cancelled?: boolean;
  fontCss?: string;
};
