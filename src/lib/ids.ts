import * as Crypto from 'expo-crypto';

/** Random UUID v4 for primary keys. */
export function newId(): string {
  return Crypto.randomUUID();
}

/** Short human code for a product, e.g. GTH-0042. */
export function productCode(sequence: number): string {
  return `GTH-${String(sequence).padStart(4, '0')}`;
}

/** Bill number, e.g. B-2026-0007. */
export function billNumber(year: number, sequence: number): string {
  return `B-${year}-${String(sequence).padStart(4, '0')}`;
}
