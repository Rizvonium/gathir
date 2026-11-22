/**
 * The ONLY place piece counts change (docs/PLAN.md §5).
 *
 * Every change writes a `stock_moves` row and updates the cached `colours.pieces`
 * in the same transaction. drizzle's expo-sqlite driver is synchronous: transaction
 * callbacks must NOT be async and must use `.run()` / `.get()` / `.all()`.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';

import { newId } from '@/lib/ids';

import type { DbOrTx } from './types';
import { colours, stockMoves, type StockReason } from './schema';

export class StockError extends Error {
  constructor(
    message: string,
    public readonly code: 'not_found' | 'insufficient' | 'invalid',
  ) {
    super(message);
    this.name = 'StockError';
  }
}

export type MoveInput = {
  colourId: string;
  delta: number;
  reason: StockReason;
  saleId?: string | null;
  note?: string;
  at?: number;
};

/**
 * Apply one stock move inside an existing transaction (or the db).
 * Throws StockError('insufficient') if the count would go below zero.
 * Returns the new piece count.
 */
export function applyMove(tx: DbOrTx, input: MoveInput): number {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new StockError('Stock change must be a non-zero whole number', 'invalid');
  }
  const colour = tx
    .select({ id: colours.id, productId: colours.productId, pieces: colours.pieces })
    .from(colours)
    .where(eq(colours.id, input.colourId))
    .get();
  if (!colour) throw new StockError('Colour not found', 'not_found');

  const next = colour.pieces + input.delta;
  if (next < 0) {
    throw new StockError(`Only ${colour.pieces} piece(s) left`, 'insufficient');
  }
  const at = input.at ?? Date.now();
  tx.insert(stockMoves)
    .values({
      id: newId(),
      colourId: colour.id,
      productId: colour.productId,
      delta: input.delta,
      reason: input.reason,
      saleId: input.saleId ?? null,
      note: input.note ?? '',
      createdAt: at,
    })
    .run();
  tx.update(colours).set({ pieces: next, updatedAt: at }).where(eq(colours.id, colour.id)).run();
  return next;
}

/** Apply a single move in its own transaction. */
export function adjustStock(database: DbOrTx, input: MoveInput): number {
  return database.transaction((tx) => applyMove(tx, input));
}

/** Total live pieces for a product (non-deleted colours). */
export function productPieces(tx: DbOrTx, productId: string): number {
  const row = tx
    .select({ total: sql<number>`coalesce(sum(${colours.pieces}), 0)` })
    .from(colours)
    .where(and(eq(colours.productId, productId), isNull(colours.deletedAt)))
    .get();
  return row?.total ?? 0;
}

/**
 * Integrity check: cached counts must equal the sum of moves.
 * Returns colour ids whose cache disagrees (should always be empty).
 */
export function findCountDrift(tx: DbOrTx): { colourId: string; cached: number; ledger: number }[] {
  const rows = tx
    .select({
      colourId: colours.id,
      cached: colours.pieces,
      ledger: sql<number>`coalesce((select sum(sm.delta) from stock_moves sm where sm.colour_id = "colours"."id"), 0)`,
    })
    .from(colours)
    .all();
  return rows.filter((r) => r.cached !== r.ledger);
}
