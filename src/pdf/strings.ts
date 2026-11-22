/**
 * Translators for PDF templates and share texts. Templates are pure functions, so they use the
 * i18next instance directly (resources are bundled, so it is ready synchronously).
 */
import type { TFunction } from 'i18next';

import i18n from '@/i18n';

/** `t` scoped to the "pdf" object of a namespace: tPdf('catalogue')('cover.preparedFor', …). */
export function pdfT(ns: 'catalogue' | 'report'): TFunction {
  return i18n.getFixedT(null, ns, 'pdf');
}

/** `t` scoped to the "share" object of a namespace (WhatsApp texts). */
export function shareT(ns: 'catalogue' | 'report'): TFunction {
  return i18n.getFixedT(null, ns, 'share');
}

/** Current language code, used for <html lang>. */
export function pdfLang(): string {
  return i18n.language || 'en';
}

/** 'rtl' for Urdu (planned), otherwise 'ltr'. */
export function pdfDir(): 'rtl' | 'ltr' {
  return i18n.dir(pdfLang()) === 'rtl' ? 'rtl' : 'ltr';
}
