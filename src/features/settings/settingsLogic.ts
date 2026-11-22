/** Pure helpers for the settings screens. */

export const LOW_STOCK_MIN = 0;
export const LOW_STOCK_MAX = 20;
export const CATEGORY_NAME_MAX = 30;

export function clampLowStock(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(LOW_STOCK_MAX, Math.max(LOW_STOCK_MIN, Math.round(n)));
}

/** Moves the item at `index` one place up (-1) or down (+1). Out-of-range moves return a copy. */
export function moveItem<T>(items: readonly T[], index: number, dir: -1 | 1): T[] {
  const out = [...items];
  const to = index + dir;
  if (index < 0 || index >= out.length || to < 0 || to >= out.length) return out;
  [out[index], out[to]] = [out[to], out[index]];
  return out;
}

/** Trimmed, single-spaced category name, or null when empty / too long. */
export function cleanCategoryName(name: string): string | null {
  const v = name.replace(/\s+/g, ' ').trim();
  if (!v || v.length > CATEGORY_NAME_MAX) return null;
  return v;
}

/** True when another category already has this name (case-insensitive). */
export function isDuplicateName(name: string, existing: readonly { id: string; name: string }[], exceptId?: string): boolean {
  const n = name.trim().toLocaleLowerCase();
  return existing.some((c) => c.id !== exceptId && c.name.trim().toLocaleLowerCase() === n);
}

export type ShopForm = { shopName: string; sellerName: string; phone: string; address: string; upiId: string };

export type ShopFormErrors = Partial<Record<keyof ShopForm, 'required' | 'upi'>>;

/** Shop name is required; a UPI ID, if given, looks like name@bank. Phone is checked by PhoneInput. */
export function validateShop(f: ShopForm): ShopFormErrors {
  const e: ShopFormErrors = {};
  if (!f.shopName.trim()) e.shopName = 'required';
  if (f.upiId.trim() && !/^[\w.-]{2,}@[a-zA-Z][\w.-]*$/.test(f.upiId.trim())) e.upiId = 'upi';
  return e;
}

export function trimShop(f: ShopForm): ShopForm {
  return { shopName: f.shopName.trim(), sellerName: f.sellerName.trim(), phone: f.phone, address: f.address.trim(), upiId: f.upiId.trim() };
}

/** "3 days ago"-style bucket for the last backup. */
export type BackupAge = { kind: 'never' } | { kind: 'today' } | { kind: 'days'; days: number };

export function backupAge(lastBackupAt: number | null, now: number): BackupAge {
  if (lastBackupAt === null) return { kind: 'never' };
  const d0 = new Date(lastBackupAt);
  d0.setHours(0, 0, 0, 0);
  const d1 = new Date(now);
  d1.setHours(0, 0, 0, 0);
  const days = Math.round((d1.getTime() - d0.getTime()) / 86_400_000);
  return days <= 0 ? { kind: 'today' } : { kind: 'days', days };
}

/** A weekly backup is the plan (PLAN §3); older than 7 days is shown as a warning. */
export function backupIsStale(lastBackupAt: number | null, now: number): boolean {
  const a = backupAge(lastBackupAt, now);
  return a.kind === 'never' || (a.kind === 'days' && a.days > 7);
}
