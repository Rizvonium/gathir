/**
 * "Hide profit" eye toggle, shared by Home, Sales, Sale detail, the Sell sheet and the Profit
 * screen: hiding on one screen hides everywhere (a customer may be looking at the counter).
 * Kept in memory only, visible by default; every app start shows profit again.
 */
import { create } from 'zustand';

type ProfitPrivacy = {
  hidden: boolean;
  toggle: () => void;
  setHidden: (hidden: boolean) => void;
};

export const useProfitPrivacy = create<ProfitPrivacy>((set) => ({
  hidden: false,
  toggle: () => set((s) => ({ hidden: !s.hidden })),
  setHidden: (hidden) => set({ hidden }),
}));

/** True while profit figures may be shown. */
export function useProfitVisible(): boolean {
  return !useProfitPrivacy((s) => s.hidden);
}

/** What a hidden figure shows instead of the number. */
export const HIDDEN_FIGURE = '••••';
