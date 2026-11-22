/** Customer book reads: list with computed totals, profile, learned likes, suggestions. */
import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import { customerEvents, customers, products, sales, type Customer, type CustomerEvent, type CustomerLikes, type CustomerTag } from '../schema';
import type { DbOrTx } from '../types';
import { DAY_MS, RECENTLY_DELETED_DAYS, swatchKeyFor } from './constants';
import { parseLikes } from './customerWrites';
import { loadLiveProducts, type ProductListRow } from './productQueries';
import { itemsBySale } from './saleQueries';

export type CustomerStats = { lifetimeSpendPaise: number; purchases: number; lastVisitAt: number | null };

export type CustomerListRow = CustomerStats & {
  id: string;
  name: string;
  phone: string | null;
  whatsappOk: boolean;
  city: string;
  tag: CustomerTag;
  /** First liked colour swatch key (tints the avatar), or null. */
  favouriteColour: string | null;
  /** Earliest open follow-up due time, or null. */
  nextFollowUpAt: number | null;
  createdAt: number;
};

export type CustomerSort = 'recent' | 'spend' | 'name';
export type CustomerListFilters = {
  search?: string;
  tag?: CustomerTag;
  /** Only customers with an open follow-up due by `now`. */
  followUpDue?: boolean;
  /** Only customers who have not bought anything in this many days. */
  inactiveDays?: number;
  sort?: CustomerSort;
};

export type LearnedLikes = {
  /** Most bought crafts, best first (max 3). */
  crafts: string[];
  /** Most bought colour swatch keys, best first (max 3). */
  colours: string[];
  budgetMinPaise: number | null;
  budgetMaxPaise: number | null;
};

export type TimelineItem = { productName: string; colourName: string; colourHex: string; qty: number; ratePaise: number; photoName: string | null };
export type TimelineEntry =
  | { kind: 'sale'; at: number; saleId: string; billNo: string; totalPaise: number; cancelled: boolean; items: TimelineItem[] }
  | { kind: 'return'; at: number; saleId: string; billNo: string; totalPaise: number }
  | { kind: 'event'; at: number; event: CustomerEvent };

export type CustomerProfile = {
  customer: Customer;
  likes: CustomerLikes;
  stats: CustomerStats & { piecesBought: number };
  learnedLikes: LearnedLikes;
  openFollowUps: CustomerEvent[];
  timeline: TimelineEntry[];
};

export type SuggestedProduct = ProductListRow & { score: number; reasons: ('craft' | 'colour' | 'budget')[] };

export type DeletedCustomerRow = { id: string; name: string; phone: string | null; deletedAt: number; purgeAt: number };

/** Lifetime totals per customer from non-cancelled sales. */
function statsByCustomer(db: DbOrTx): Map<string, CustomerStats> {
  const rows = db
    .select({
      customerId: sales.customerId,
      spend: sql<number>`coalesce(sum(${sales.totalPaise}), 0)`,
      n: sql<number>`count(*)`,
      last: sql<number | null>`max(${sales.createdAt})`,
    })
    .from(sales)
    .where(and(isNotNull(sales.customerId), isNull(sales.cancelledAt)))
    .groupBy(sales.customerId)
    .all();
  return new Map(rows.map((r) => [r.customerId ?? '', { lifetimeSpendPaise: r.spend, purchases: r.n, lastVisitAt: r.last }]));
}

/** Customer list with lifetime spend, purchases and last visit computed from sales. */
export function listCustomers(db: DbOrTx, filters: CustomerListFilters = {}, now: number = Date.now()): CustomerListRow[] {
  const { search = '', tag, followUpDue, inactiveDays, sort = 'recent' } = filters;
  const stats = statsByCustomer(db);
  const followUps = db
    .select({ customerId: customerEvents.customerId, due: sql<number>`min(${customerEvents.dueAt})` })
    .from(customerEvents)
    .where(and(eq(customerEvents.kind, 'follow_up'), isNull(customerEvents.doneAt), isNotNull(customerEvents.dueAt)))
    .groupBy(customerEvents.customerId)
    .all();
  const dueBy = new Map(followUps.map((f) => [f.customerId, f.due]));
  const q = search.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  const cutoff = inactiveDays !== undefined ? now - inactiveDays * DAY_MS : null;

  const rows: CustomerListRow[] = db
    .select()
    .from(customers)
    .where(isNull(customers.deletedAt))
    .all()
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      whatsappOk: c.whatsappOk,
      city: c.city,
      tag: c.tag,
      favouriteColour: parseLikes(c.likesJson).colours[0] ?? null,
      nextFollowUpAt: dueBy.get(c.id) ?? null,
      createdAt: c.createdAt,
      ...(stats.get(c.id) ?? { lifetimeSpendPaise: 0, purchases: 0, lastVisitAt: null }),
    }));

  return rows
    .filter((r) => !tag || r.tag === tag)
    .filter((r) => !followUpDue || (r.nextFollowUpAt !== null && r.nextFollowUpAt <= now))
    .filter((r) => cutoff === null || (r.lastVisitAt ?? r.createdAt) < cutoff)
    .filter((r) => {
      if (!q) return true;
      if (r.name.toLowerCase().includes(q) || r.city.toLowerCase().includes(q)) return true;
      return qDigits.length >= 3 && (r.phone ?? '').replace(/\D/g, '').includes(qDigits);
    })
    .sort((a, b) => {
      if (sort === 'spend') return b.lifetimeSpendPaise - a.lifetimeSpendPaise || a.name.localeCompare(b.name);
      if (sort === 'name') return a.name.localeCompare(b.name);
      return (b.lastVisitAt ?? b.createdAt) - (a.lastVisitAt ?? a.createdAt) || a.name.localeCompare(b.name);
    });
}

function topKeys(counts: Map<string, number>, limit: number): string[] {
  return [...counts.entries()]
    .filter(([k]) => k !== '')
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([k]) => k);
}

/** Full profile: likes, stats, learned likes, open follow-ups and a newest-first timeline. Null if missing. */
export function getCustomerProfile(db: DbOrTx, customerId: string): CustomerProfile | null {
  const customer = db.select().from(customers).where(eq(customers.id, customerId)).get();
  if (!customer) return null;
  const saleRows = db.select().from(sales).where(eq(sales.customerId, customerId)).orderBy(desc(sales.createdAt)).all();
  const items = itemsBySale(
    db,
    saleRows.map((s) => s.id),
  );
  const crafts = new Map(
    db
      .select({ id: products.id, craft: products.craft })
      .from(products)
      .all()
      .map((p) => [p.id, p.craft]),
  );

  const craftCount = new Map<string, number>();
  const colourCount = new Map<string, number>();
  const rates: number[] = [];
  let lifetimeSpendPaise = 0;
  let purchases = 0;
  let piecesBought = 0;
  let lastVisitAt: number | null = null;
  const timeline: TimelineEntry[] = [];

  for (const s of saleRows) {
    const its = items.get(s.id) ?? [];
    timeline.push({
      kind: 'sale',
      at: s.createdAt,
      saleId: s.id,
      billNo: s.billNo,
      totalPaise: s.totalPaise,
      cancelled: s.cancelledAt !== null,
      items: its.map((i) => ({
        productName: i.productNameSnapshot,
        colourName: i.colourNameSnapshot,
        colourHex: i.colourHexSnapshot,
        qty: i.qty,
        ratePaise: i.ratePaise,
        photoName: i.photoSnapshotName,
      })),
    });
    if (s.cancelledAt !== null) {
      timeline.push({ kind: 'return', at: s.cancelledAt, saleId: s.id, billNo: s.billNo, totalPaise: s.totalPaise });
      continue;
    }
    lifetimeSpendPaise += s.totalPaise;
    purchases += 1;
    lastVisitAt = Math.max(lastVisitAt ?? 0, s.createdAt);
    for (const i of its) {
      piecesBought += i.qty;
      rates.push(i.ratePaise);
      const craft = crafts.get(i.productId) ?? '';
      craftCount.set(craft, (craftCount.get(craft) ?? 0) + i.qty);
      const key = swatchKeyFor(i.colourNameSnapshot, i.colourHexSnapshot);
      colourCount.set(key, (colourCount.get(key) ?? 0) + i.qty);
    }
  }

  const events = db
    .select()
    .from(customerEvents)
    .where(eq(customerEvents.customerId, customerId))
    .orderBy(asc(customerEvents.createdAt))
    .all();
  for (const e of events) timeline.push({ kind: 'event', at: e.createdAt, event: e });
  timeline.sort((a, b) => b.at - a.at);

  return {
    customer,
    likes: parseLikes(customer.likesJson),
    stats: { lifetimeSpendPaise, purchases, lastVisitAt, piecesBought },
    learnedLikes: {
      crafts: topKeys(craftCount, 3),
      colours: topKeys(colourCount, 3),
      budgetMinPaise: rates.length ? Math.min(...rates) : null,
      budgetMaxPaise: rates.length ? Math.max(...rates) : null,
    },
    openFollowUps: events
      .filter((e) => e.kind === 'follow_up' && e.doneAt === null)
      .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0)),
    timeline,
  };
}

/**
 * In-stock products matching the customer's likes (weight 2) and learned likes (weight 1),
 * plus 1 when the rate is within their budget. Best first; empty when nothing matches.
 */
export function suggestedProducts(db: DbOrTx, customerId: string, limit = 12): SuggestedProduct[] {
  const profile = getCustomerProfile(db, customerId);
  if (!profile) return [];
  const { likes, learnedLikes } = profile;
  const lower = (a: string[]) => a.map((s) => s.toLowerCase());
  const likedCrafts = lower(likes.crafts);
  const learnedCrafts = lower(learnedLikes.crafts);
  const min = likes.budgetMinPaise ?? learnedLikes.budgetMinPaise;
  const max = likes.budgetMaxPaise ?? learnedLikes.budgetMaxPaise;

  const out: SuggestedProduct[] = [];
  for (const p of loadLiveProducts(db)) {
    if (p.totalPieces <= 0) continue;
    const reasons = new Set<SuggestedProduct['reasons'][number]>();
    let score = 0;
    const craft = p.craft.toLowerCase();
    const craftScore = !craft ? 0 : likedCrafts.includes(craft) ? 2 : learnedCrafts.includes(craft) ? 1 : 0;
    const keys = new Set(p.colours.filter((c) => c.pieces > 0).map((c) => swatchKeyFor(c.name, c.hex)));
    const colourScore = likes.colours.some((k) => keys.has(k)) ? 2 : learnedLikes.colours.some((k) => keys.has(k)) ? 1 : 0;
    if (craftScore > 0) reasons.add('craft');
    if (colourScore > 0) reasons.add('colour');
    score = craftScore + colourScore;
    if (score === 0) continue;
    if (min !== null && max !== null && p.ratePaise >= min && p.ratePaise <= max) {
      score += 1;
      reasons.add('budget');
    }
    out.push({ ...p, score, reasons: [...reasons] });
  }
  return out.sort((a, b) => b.score - a.score || b.createdAt - a.createdAt).slice(0, limit);
}

/** Deleted customers (Recently deleted), most recent first. */
export function listDeletedCustomers(db: DbOrTx, days: number = RECENTLY_DELETED_DAYS): DeletedCustomerRow[] {
  return db
    .select({ id: customers.id, name: customers.name, phone: customers.phone, deletedAt: customers.deletedAt })
    .from(customers)
    .where(isNotNull(customers.deletedAt))
    .orderBy(desc(customers.deletedAt))
    .all()
    .map((c) => ({ ...c, deletedAt: c.deletedAt ?? 0, purgeAt: (c.deletedAt ?? 0) + days * DAY_MS }));
}
