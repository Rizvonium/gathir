/**
 * The add/edit product draft and its pure updates. Screens never mutate a draft directly:
 * every change goes through a function here so it is unit-tested and the store stays thin.
 */
import type { ProductDetail } from '@/db/repo/productQueries';

export const MAX_DRAFT_PHOTOS = 8;
export const WIZARD_STEPS = 3;

export type DraftPhoto = { fileName: string; thumbName: string; width: number; height: number };

export type DraftColour = {
  /** Stable key for lists (colour id when it exists). */
  key: string;
  /** Saved colour id; null for colours added in this draft. */
  id: string | null;
  name: string;
  hex: string;
  pieces: number;
  /**
   * Buying price for this colour only (seller-only), overriding the product's; null/undefined =
   * same as the product. Optional so drafts kept from before this field still load.
   */
  costPaise?: number | null;
  /** Values when the edit started (null for new colours): saves only write real changes. */
  original: { name: string; hex: string; pieces: number; costPaise?: number | null } | null;
};

export type ProductDraft = {
  mode: 'new' | 'edit';
  productId: string | null;
  step: number;
  photos: DraftPhoto[];
  /** Files saved to disk during this draft and later removed: deleted after save/discard if unused. */
  discardedFiles: string[];
  name: string;
  categoryId: string | null;
  craft: string;
  material: string;
  size: string;
  ratePaise: number | null;
  costPaise: number | null;
  notes: string;
  oneOfAKind: boolean;
  colours: DraftColour[];
  /** Colours put aside when One-of-a-kind was switched on; they come back when it is switched off. */
  stashedColours: DraftColour[];
  /** Saved colours the seller removed in this edit. */
  removedColourIds: string[];
  updatedAt: number;
};

let keySeq = 0;
/** Local key for a colour that has no id yet. */
export function newColourKey(): string {
  keySeq += 1;
  return `new-${Date.now().toString(36)}-${keySeq}`;
}

export function emptyDraft(now: number = Date.now()): ProductDraft {
  return {
    mode: 'new',
    productId: null,
    step: 0,
    photos: [],
    discardedFiles: [],
    name: '',
    categoryId: null,
    craft: '',
    material: '',
    size: '',
    ratePaise: null,
    costPaise: null,
    notes: '',
    oneOfAKind: false,
    colours: [],
    stashedColours: [],
    removedColourIds: [],
    updatedAt: now,
  };
}

/** A draft that edits an existing product, starting from its saved values. */
export function draftFromDetail(detail: ProductDetail, now: number = Date.now()): ProductDraft {
  const p = detail.product;
  return {
    ...emptyDraft(now),
    mode: 'edit',
    productId: p.id,
    photos: detail.photos.map((ph) => ({ fileName: ph.fileName, thumbName: ph.thumbName, width: ph.width, height: ph.height })),
    name: p.name,
    categoryId: p.categoryId,
    craft: p.craft,
    material: p.material,
    size: p.size,
    ratePaise: p.ratePaise,
    costPaise: p.costPaise,
    notes: p.notes,
    oneOfAKind: p.oneOfAKind,
    colours: detail.colours.map((c) => ({
      key: c.id,
      id: c.id,
      name: c.name,
      hex: c.hex,
      pieces: c.pieces,
      costPaise: c.costPaise ?? null,
      original: { name: c.name, hex: c.hex, pieces: c.pieces, costPaise: c.costPaise ?? null },
    })),
  };
}

const touch = (d: ProductDraft, patch: Partial<ProductDraft>): ProductDraft => ({ ...d, ...patch, updatedAt: Date.now() });

/** True once the seller has entered anything worth keeping. */
export function draftHasContent(d: ProductDraft): boolean {
  return (
    d.photos.length > 0 ||
    d.name.trim() !== '' ||
    d.ratePaise !== null ||
    d.colours.length > 0 ||
    d.craft !== '' ||
    d.material !== '' ||
    d.categoryId !== null
  );
}

export function totalDraftPieces(d: ProductDraft): number {
  return d.colours.reduce((s, c) => s + c.pieces, 0);
}

// ---------- step ----------

export function setStep(d: ProductDraft, step: number): ProductDraft {
  return touch(d, { step: Math.max(0, Math.min(WIZARD_STEPS - 1, step)) });
}

// ---------- fields ----------

export type DraftFields = Pick<ProductDraft, 'name' | 'categoryId' | 'craft' | 'material' | 'size' | 'ratePaise' | 'costPaise' | 'notes'>;

export function setFields(d: ProductDraft, patch: Partial<DraftFields>): ProductDraft {
  return touch(d, patch);
}

/** Chip toggle: tapping the selected chip clears it. */
export function toggleValue(current: string, value: string): string {
  return current === value ? '' : value;
}

// ---------- photos ----------

/** Adds saved photos up to the limit; returns photos that did not fit (delete their files). */
export function addPhotos(d: ProductDraft, added: DraftPhoto[]): { draft: ProductDraft; overflow: DraftPhoto[] } {
  const room = Math.max(0, MAX_DRAFT_PHOTOS - d.photos.length);
  const fits = added.slice(0, room);
  return { draft: touch(d, { photos: [...d.photos, ...fits] }), overflow: added.slice(room) };
}

export function removePhoto(d: ProductDraft, fileName: string): ProductDraft {
  const photo = d.photos.find((p) => p.fileName === fileName);
  if (!photo) return d;
  return touch(d, {
    photos: d.photos.filter((p) => p.fileName !== fileName),
    discardedFiles: [...d.discardedFiles, photo.fileName, photo.thumbName],
  });
}

/** Moves the photo at `from` to `to` (clamped). Index 0 is the cover. */
export function movePhoto(d: ProductDraft, from: number, to: number): ProductDraft {
  if (from < 0 || from >= d.photos.length) return d;
  const target = Math.max(0, Math.min(d.photos.length - 1, to));
  if (target === from) return d;
  const next = [...d.photos];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return touch(d, { photos: next });
}

export function makeCover(d: ProductDraft, index: number): ProductDraft {
  return movePhoto(d, index, 0);
}

// ---------- colours ----------

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function findColour(d: ProductDraft, name: string): DraftColour | undefined {
  return d.colours.find((c) => sameName(c.name, name));
}

/**
 * Adds a colour (1 piece) or, when the name is already there, leaves the draft unchanged.
 * One-of-a-kind keeps a single colour: picking another replaces it.
 */
export function addColour(d: ProductDraft, name: string, hex: string): ProductDraft {
  const trimmed = name.trim();
  if (!trimmed || findColour(d, trimmed)) return d;
  const restored = d.stashedColours.find((c) => sameName(c.name, trimmed));
  const colour: DraftColour = restored
    ? { ...restored, pieces: Math.max(1, restored.pieces) }
    : { key: newColourKey(), id: null, name: trimmed, hex, pieces: 1, original: null };
  const stashedColours = restored ? d.stashedColours.filter((c) => c !== restored) : d.stashedColours;
  if (d.oneOfAKind) {
    // Keep a single colour: the previous pick is put aside, not lost.
    return touch(d, { colours: [{ ...colour, pieces: 1 }], stashedColours: [...d.colours, ...stashedColours] });
  }
  return touch(d, { colours: [...d.colours, colour], stashedColours });
}

export function removeColour(d: ProductDraft, key: string): ProductDraft {
  const colour = d.colours.find((c) => c.key === key);
  if (!colour) return d;
  return touch(d, {
    colours: d.colours.filter((c) => c.key !== key),
    removedColourIds: colour.id ? [...d.removedColourIds, colour.id] : d.removedColourIds,
  });
}

/** Swatch tap: adds the colour, or removes it when already picked. */
export function toggleSwatch(d: ProductDraft, name: string, hex: string): ProductDraft {
  const existing = findColour(d, name);
  return existing ? removeColour(d, existing.key) : addColour(d, name, hex);
}

export function setColourPieces(d: ProductDraft, key: string, pieces: number): ProductDraft {
  const value = Math.max(0, Math.floor(pieces));
  const max = d.oneOfAKind ? 1 : Number.MAX_SAFE_INTEGER;
  return touch(d, { colours: d.colours.map((c) => (c.key === key ? { ...c, pieces: Math.min(max, value) } : c)) });
}

/** Buying price for one colour (null = same as the design's buying price). Negative or fractional values are ignored. */
export function setColourCost(d: ProductDraft, key: string, costPaise: number | null): ProductDraft {
  if (costPaise !== null && (!Number.isInteger(costPaise) || costPaise < 0)) return d;
  return touch(d, { colours: d.colours.map((c) => (c.key === key ? { ...c, costPaise } : c)) });
}

/** Colours that have their own buying price. */
export function coloursWithOwnCost(d: ProductDraft): DraftColour[] {
  return d.colours.filter((c) => c.costPaise !== null && c.costPaise !== undefined);
}

/**
 * Seller-only warnings (never block Save): the rate is below the buying price, for the design
 * or for a colour with its own price.
 */
export type CostWarnings = { rateBelowCost: boolean; coloursBelowCost: string[] };

export function costWarnings(d: ProductDraft): CostWarnings {
  const rate = d.ratePaise;
  if (rate === null) return { rateBelowCost: false, coloursBelowCost: [] };
  return {
    rateBelowCost: d.costPaise !== null && d.costPaise > rate,
    coloursBelowCost: coloursWithOwnCost(d)
      .filter((c) => (c.costPaise ?? 0) > rate)
      .map((c) => c.key),
  };
}

/**
 * One-of-a-kind: a single colour with at most one piece. Switching on keeps the first colour
 * and puts the others aside; switching off brings them back (nothing typed is lost).
 */
export function setOneOfAKind(d: ProductDraft, on: boolean): ProductDraft {
  if (on === d.oneOfAKind) return d;
  if (on) {
    const [first, ...rest] = d.colours;
    const kept = first ? [{ ...first, pieces: first.original ? Math.min(1, first.pieces) : 1 }] : [];
    return touch(d, { oneOfAKind: true, colours: kept, stashedColours: [...rest, ...d.stashedColours] });
  }
  return touch(d, { oneOfAKind: false, colours: [...d.colours, ...d.stashedColours], stashedColours: [] });
}

// ---------- validation ----------

export type DraftErrors = {
  name?: 'nameRequired';
  rate?: 'rateRequired';
  colours?: 'coloursRequired';
};

/** The name that will be saved: what was typed, else the first suggestion. */
export function resolvedName(d: ProductDraft, suggestion: string | undefined): string {
  return d.name.trim() || (suggestion ?? '').trim();
}

export function validateDraft(d: ProductDraft, suggestion: string | undefined): DraftErrors {
  const errors: DraftErrors = {};
  if (!resolvedName(d, suggestion)) errors.name = 'nameRequired';
  if (d.ratePaise === null || !Number.isInteger(d.ratePaise) || d.ratePaise < 0) errors.rate = 'rateRequired';
  if (d.colours.length === 0) errors.colours = 'coloursRequired';
  return errors;
}

/** Wizard step that holds the first error (to jump there on Save). */
export function firstErrorStep(errors: DraftErrors): number | null {
  if (errors.name || errors.rate) return 1;
  if (errors.colours) return 2;
  return null;
}

export const hasErrors = (e: DraftErrors) => Object.keys(e).length > 0;
