/**
 * Auto-saved add/edit drafts, kept in memory for the app session: leaving the wizard and
 * coming back finds the draft where it was. One draft for "new", one per edited product.
 * Cleared on save or discard. While a camera/gallery picker is open the draft is also written to
 * app storage (logic/pendingPick), so it survives Android closing the app.
 */
import { create } from 'zustand';

import { emptyDraft, type ProductDraft } from '../logic/draft';

export const NEW_DRAFT_KEY = 'new';

type DraftState = {
  drafts: Record<string, ProductDraft>;
  /** Product just created: its Stock card pops once when it first appears. */
  justSavedId: string | null;
  /** Applies `fn` to the stored draft, or to `base` (default: an empty draft) when none is stored yet. */
  update: (key: string, fn: (d: ProductDraft) => ProductDraft, base?: ProductDraft) => void;
  put: (key: string, draft: ProductDraft) => void;
  clear: (key: string) => void;
  markSaved: (productId: string | null) => void;
};

export const useDraftStore = create<DraftState>((set) => ({
  drafts: {},
  justSavedId: null,
  update: (key, fn, base) =>
    set((s) => {
      const current = s.drafts[key] ?? base ?? emptyDraft();
      const next = fn(current);
      return next === current ? s : { drafts: { ...s.drafts, [key]: next } };
    }),
  put: (key, draft) => set((s) => ({ drafts: { ...s.drafts, [key]: draft } })),
  clear: (key) =>
    set((s) => {
      if (!(key in s.drafts)) return s;
      const rest = { ...s.drafts };
      delete rest[key];
      return { drafts: rest };
    }),
  markSaved: (productId) => set({ justSavedId: productId }),
}));

export const draftKeyFor = (productId: string | null | undefined) => productId ?? NEW_DRAFT_KEY;
