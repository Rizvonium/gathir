/**
 * In-memory state of one "Send catalogue" run, shared by its four routes
 * (/catalogue → /catalogue/options → /catalogue/preview → /catalogue/send).
 * Started fresh every time /catalogue opens; the prepared photos are kept between
 * preview and send so a PDF is never built twice.
 */
import { create } from 'zustand';

import type { CatalogueData } from '@/db/repo/reports';

import type { CatalogueForm } from './logic/options';
import { initialSource, paramValue, type FlowParams, type SourceState } from './logic/selection';

export type Prepared = {
  /** selectionKey + formKey the data was built for. */
  key: string;
  data: CatalogueData;
  photos: ReadonlyMap<string, string>;
  fontCss: string;
  fallbackTitle: string;
};

type FlowState = {
  /** Bumps on every start(): screens use it to drop stale async results. */
  runId: number;
  source: SourceState;
  /** Customer the flow was opened for (customer profile, Showroom); null = choose at the end. */
  customerId: string | null;
  /** Options being edited; null until loaded from settings. */
  form: CatalogueForm | null;
  prepared: Prepared | null;
  start: (params: FlowParams) => void;
  setSource: (fn: (s: SourceState) => SourceState) => void;
  setForm: (form: CatalogueForm) => void;
  setPrepared: (p: Prepared | null) => void;
};

export const useCatalogueFlow = create<FlowState>((set) => ({
  runId: 0,
  source: { kind: 'all', categoryId: null, productIds: [] },
  customerId: null,
  form: null,
  prepared: null,
  start: (params) =>
    set((s) => ({
      runId: s.runId + 1,
      source: initialSource(params),
      customerId: paramValue(params.customerId),
      form: null,
      prepared: null,
    })),
  setSource: (fn) => set((s) => ({ source: fn(s.source) })),
  setForm: (form) => set({ form }),
  setPrepared: (prepared) => set({ prepared }),
}));
