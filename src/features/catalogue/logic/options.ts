/**
 * Catalogue options (PLAN §6 "Options, remembered for next time"). Pure: no React, no expo.
 * Stored as JSON in shop_settings.catalogue_options_json; the style is mirrored in catalogue_style.
 */
import type { CatalogueOptions as RepoCatalogueOptions } from '@/db/repo/reports';
import { addDays, endOfDay } from '@/lib/dates';
import type { CatalogueColumns, CatalogueDocOptions, CatalogueStyle } from '@/pdf/types';

/** "Rates valid till" choices, in days from today. 0 = do not print a date. */
export const VALID_FOR_CHOICES = [0, 7, 15, 30] as const;
export type ValidForDays = (typeof VALID_FOR_CHOICES)[number];

export type CatalogueForm = {
  showRates: boolean;
  showOnlyLeft: boolean;
  showExactCounts: boolean;
  hideSoldOut: boolean;
  title: string;
  /** Per customer: never remembered. */
  personalNote: string;
  validForDays: ValidForDays;
  discountLine: string;
  style: CatalogueStyle;
  columns: CatalogueColumns;
};

export const DEFAULT_FORM: CatalogueForm = {
  showRates: true,
  showOnlyLeft: true,
  showExactCounts: false,
  hideSoldOut: true,
  title: '',
  personalNote: '',
  validForDays: 0,
  discountLine: '',
  style: 'bazaar',
  columns: 2,
};

const MAX_TEXT = 140;

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function text(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, MAX_TEXT) : '';
}

/** Reads the remembered options. Bad or missing JSON falls back to the defaults, never throws. */
export function parseStoredForm(json: string | null | undefined, fallbackStyle: CatalogueStyle = 'bazaar'): CatalogueForm {
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(json || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const style: CatalogueStyle = raw.style === 'ivory' || raw.style === 'bazaar' ? raw.style : fallbackStyle;
  const columns: CatalogueColumns = raw.columns === 3 ? 3 : 2;
  const validForDays = (VALID_FOR_CHOICES as readonly unknown[]).includes(raw.validForDays) ? (raw.validForDays as ValidForDays) : 0;
  return {
    showRates: bool(raw.showRates, DEFAULT_FORM.showRates),
    showOnlyLeft: bool(raw.showOnlyLeft, DEFAULT_FORM.showOnlyLeft),
    showExactCounts: bool(raw.showExactCounts, DEFAULT_FORM.showExactCounts),
    hideSoldOut: bool(raw.hideSoldOut, DEFAULT_FORM.hideSoldOut),
    title: text(raw.title),
    personalNote: '',
    validForDays,
    discountLine: text(raw.discountLine),
    style,
    columns,
  };
}

/** What is remembered for next time (everything except the personal note). */
export function storedFormJson(form: CatalogueForm): string {
  const { personalNote: _note, ...rest } = form;
  return JSON.stringify({ ...rest, title: rest.title.trim(), discountLine: rest.discountLine.trim() });
}

/** End of the day `validForDays` from now, or null when no date is printed. */
export function ratesValidTill(validForDays: ValidForDays, now: number): number | null {
  return validForDays > 0 ? endOfDay(addDays(now, validForDays)) : null;
}

/** Options for buildCatalogueData (rates/counts/sold-out). */
export function dataOptions(form: CatalogueForm): RepoCatalogueOptions {
  return { hideSoldOut: form.hideSoldOut, showRates: form.showRates, showCounts: form.showExactCounts };
}

/** Layout for catalogueDocFromData. Exact counts already say how many are left. */
export function layoutOptions(form: CatalogueForm): Pick<CatalogueDocOptions, 'style' | 'columns' | 'showOnlyLeft'> {
  return { style: form.style, columns: form.columns, showOnlyLeft: form.showOnlyLeft };
}

/** Stable key for "has anything that changes the PDF changed?" (preview cache). */
export function formKey(form: CatalogueForm): string {
  return JSON.stringify(form);
}
