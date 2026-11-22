/**
 * Gathir database schema (docs/PLAN.md §8).
 *
 * Rules:
 * - Money is integer paise. Timestamps are epoch milliseconds.
 * - `colours.pieces` is a cached count. It changes ONLY together with a `stock_moves`
 *   row in the same transaction (see src/db/stock.ts).
 * - Deletes are soft (`deleted_at`), kept 30 days in Recently deleted.
 */
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
};

export const shopSettings = sqliteTable('shop_settings', {
  id: integer('id').primaryKey(), // always 1
  shopName: text('shop_name').notNull().default(''),
  sellerName: text('seller_name').notNull().default(''),
  sellerCode: text('seller_code').notNull().default(''),
  phone: text('phone').notNull().default(''),
  address: text('address').notNull().default(''),
  upiId: text('upi_id').notNull().default(''),
  ownerWhatsapp: text('owner_whatsapp').notNull().default(''),
  language: text('language').notNull().default('en'),
  lowStockLevel: integer('low_stock_level').notNull().default(1),
  catalogueStyle: text('catalogue_style', { enum: ['bazaar', 'ivory'] }).notNull().default('bazaar'),
  catalogueOptionsJson: text('catalogue_options_json').notNull().default('{}'),
  reportIncludesCustomerPhones: integer('report_includes_customer_phones', { mode: 'boolean' }).notNull().default(true),
  showroomShowsExactCounts: integer('showroom_shows_exact_counts', { mode: 'boolean' }).notNull().default(false),
  pinHashSet: integer('pin_hash_set', { mode: 'boolean' }).notNull().default(false), // hash itself lives in expo-secure-store
  onboardedAt: integer('onboarded_at'),
  lastBackupAt: integer('last_backup_at'),
  productSeq: integer('product_seq').notNull().default(0),
  billSeq: integer('bill_seq').notNull().default(0),
  reportSeq: integer('report_seq').notNull().default(0),
  ...timestamps,
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull().default('category'), // Material icon name
  sortOrder: integer('sort_order').notNull().default(0),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
});

export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    categoryId: text('category_id').references(() => categories.id),
    craft: text('craft').notNull().default(''), // Sozni, Kani, Aari, Tilla, Plain…
    material: text('material').notNull().default(''), // Pashmina, Wool, Silk…
    size: text('size').notNull().default(''),
    ratePaise: integer('rate_paise').notNull().default(0),
    costPaise: integer('cost_paise'),
    notes: text('notes').notNull().default(''),
    oneOfAKind: integer('one_of_a_kind', { mode: 'boolean' }).notNull().default(false),
    coverPhotoId: text('cover_photo_id'),
    isSample: integer('is_sample', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at'),
    ...timestamps,
  },
  (t) => [uniqueIndex('products_code_idx').on(t.code), index('products_deleted_idx').on(t.deletedAt)],
);

export const colours = sqliteTable(
  'colours',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    name: text('name').notNull(),
    hex: text('hex').notNull(), // '#RRGGBB' or 'multi'
    pieces: integer('pieces').notNull().default(0), // cached sum of stock_moves.delta
    sortOrder: integer('sort_order').notNull().default(0),
    deletedAt: integer('deleted_at'),
    ...timestamps,
  },
  (t) => [index('colours_product_idx').on(t.productId)],
);

export const photos = sqliteTable(
  'photos',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    fileName: text('file_name').notNull(), // relative to <documents>/photos/
    thumbName: text('thumb_name').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('photos_product_idx').on(t.productId)],
);

export const STOCK_REASONS = ['added', 'sold', 'returned', 'damaged', 'correction', 'returned_to_owner', 'sample', 'deleted', 'restored', 'opening'] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

export const stockMoves = sqliteTable(
  'stock_moves',
  {
    id: text('id').primaryKey(),
    colourId: text('colour_id')
      .notNull()
      .references(() => colours.id),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    delta: integer('delta').notNull(),
    reason: text('reason', { enum: STOCK_REASONS }).notNull(),
    saleId: text('sale_id'),
    note: text('note').notNull().default(''),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('moves_colour_idx').on(t.colourId), index('moves_created_idx').on(t.createdAt)],
);

export const CUSTOMER_TAGS = ['regular', 'wholesale', 'tourist', 'walk_in', 'other'] as const;
export type CustomerTag = (typeof CUSTOMER_TAGS)[number];

export type CustomerLikes = {
  colours: string[]; // swatch keys
  crafts: string[];
  budgetMinPaise?: number;
  budgetMaxPaise?: number;
};

export const customers = sqliteTable(
  'customers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    phone: text('phone'), // E.164, e.g. +919876543210
    whatsappOk: integer('whatsapp_ok', { mode: 'boolean' }).notNull().default(true),
    city: text('city').notNull().default(''),
    address: text('address').notNull().default(''),
    tag: text('tag', { enum: CUSTOMER_TAGS }).notNull().default('regular'),
    notes: text('notes').notNull().default(''),
    likesJson: text('likes_json').notNull().default('{"colours":[],"crafts":[]}'),
    deletedAt: integer('deleted_at'),
    ...timestamps,
  },
  (t) => [index('customers_phone_idx').on(t.phone), index('customers_deleted_idx').on(t.deletedAt)],
);

export const CUSTOMER_EVENT_KINDS = ['note', 'catalogue_sent', 'card_sent', 'follow_up', 'liked_item'] as const;
export type CustomerEventKind = (typeof CUSTOMER_EVENT_KINDS)[number];

export const customerEvents = sqliteTable(
  'customer_events',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    kind: text('kind', { enum: CUSTOMER_EVENT_KINDS }).notNull(),
    refId: text('ref_id'), // product id / report id
    note: text('note').notNull().default(''),
    dueAt: integer('due_at'),
    doneAt: integer('done_at'),
    notificationId: text('notification_id'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('events_customer_idx').on(t.customerId), index('events_due_idx').on(t.dueAt)],
);

export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const sales = sqliteTable(
  'sales',
  {
    id: text('id').primaryKey(),
    billNo: text('bill_no').notNull(),
    customerId: text('customer_id').references(() => customers.id),
    customerNameSnapshot: text('customer_name_snapshot'),
    customerPhoneSnapshot: text('customer_phone_snapshot'),
    payment: text('payment', { enum: PAYMENT_METHODS }).notNull().default('cash'),
    discountPaise: integer('discount_paise').notNull().default(0),
    totalPaise: integer('total_paise').notNull(),
    note: text('note').notNull().default(''),
    createdAt: integer('created_at').notNull(),
    cancelledAt: integer('cancelled_at'),
    reportId: text('report_id'),
  },
  (t) => [index('sales_created_idx').on(t.createdAt), index('sales_customer_idx').on(t.customerId)],
);

export const saleItems = sqliteTable(
  'sale_items',
  {
    id: text('id').primaryKey(),
    saleId: text('sale_id')
      .notNull()
      .references(() => sales.id),
    productId: text('product_id').notNull(),
    colourId: text('colour_id').notNull(),
    productNameSnapshot: text('product_name_snapshot').notNull(),
    productCodeSnapshot: text('product_code_snapshot').notNull().default(''),
    colourNameSnapshot: text('colour_name_snapshot').notNull(),
    colourHexSnapshot: text('colour_hex_snapshot').notNull().default(''),
    photoSnapshotName: text('photo_snapshot_name'), // copied thumb kept even if product deleted
    qty: integer('qty').notNull(),
    ratePaise: integer('rate_paise').notNull(),
  },
  (t) => [index('sale_items_sale_idx').on(t.saleId)],
);

export const REPORT_KINDS = ['owner', 'catalogue', 'bill', 'card'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  number: integer('number').notNull().default(0),
  kind: text('kind', { enum: REPORT_KINDS }).notNull(),
  periodFrom: integer('period_from'),
  periodTo: integer('period_to'),
  fileName: text('file_name'),
  customerId: text('customer_id'),
  summaryJson: text('summary_json').notNull().default('{}'),
  fingerprint: text('fingerprint').notNull().default(''),
  createdAt: integer('created_at').notNull(),
  sentAt: integer('sent_at'),
});

export type ShopSettings = typeof shopSettings.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Colour = typeof colours.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type StockMove = typeof stockMoves.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type CustomerEvent = typeof customerEvents.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type Report = typeof reports.$inferSelect;

export const _sql = sql; // re-export convenience for raw fragments
