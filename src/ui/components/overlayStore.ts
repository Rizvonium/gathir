/**
 * Which overlays are up, shared by the app lock, sheets and toasts.
 *
 * @expo/ui sheets are Compose `ModalBottomSheet`s: each lives in its own dialog window above the
 * activity window, where every React Native view (toasts, the PIN pad) is drawn. So:
 * - while the app is locked, sheets are taken down (they would sit above the PIN pad, usable)
 *   and toasts wait (their buttons would sit above the PIN pad);
 * - while a sheet is open, toasts are shown inside the top sheet (in the activity window they
 *   would be hidden under the sheet's scrim).
 */
import { create } from 'zustand';

type OverlayState = {
  /** The PIN pad is up. */
  locked: boolean;
  /** Ids of the sheets that are presented now, oldest first (the last one is on top). */
  sheets: string[];
  setLocked: (locked: boolean) => void;
  sheetOpened: (id: string) => void;
  sheetClosed: (id: string) => void;
};

export const useOverlayStore = create<OverlayState>((set) => ({
  locked: false,
  sheets: [],
  setLocked: (locked) => set((s) => (s.locked === locked ? s : { locked })),
  sheetOpened: (id) => set((s) => (s.sheets.includes(id) ? s : { sheets: [...s.sheets, id] })),
  sheetClosed: (id) => set((s) => (s.sheets.includes(id) ? { sheets: s.sheets.filter((x) => x !== id) } : s)),
}));

/** Tells sheets and toasts whether the app lock is up (called by the lock gate). */
export function setScreenLocked(locked: boolean): void {
  useOverlayStore.getState().setLocked(locked);
}
