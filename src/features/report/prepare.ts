/**
 * Device side of the owner report: repo data → photos → doc → HTML (PLAN §7, PLATFORM_API §7).
 * The same HTML is shown in the preview and printed to the PDF.
 */
import * as Application from 'expo-application';

import { db } from '@/db/client';
import { buildOwnerReportData, computeFingerprint } from '@/db/repo/reports';
import { photoAsDataUri } from '@/lib/photos';
import { REPORT_THUMB, getPdfFontCss, loadPhotoMap, ownerReportDocFromData, ownerReportPhotoNames, renderOwnerReportHtml } from '@/pdf';

import type { Range } from './period';
import type { PreparedReport } from './store';

export function appVersion(): string {
  return Application.nativeApplicationVersion ?? '1.0.0';
}

export async function prepareOwnerReport(range: Range, includeCustomerPhones: boolean, key: string, now: number = Date.now()): Promise<PreparedReport> {
  const data = buildOwnerReportData(db, { from: range.from, to: range.to, includeCustomerPhones, now });
  const fingerprint = computeFingerprint(data);
  const [photos, fontCss] = await Promise.all([loadPhotoMap(ownerReportPhotoNames(data), photoAsDataUri, REPORT_THUMB), getPdfFontCss()]);
  const doc = ownerReportDocFromData(data, { appVersion: appVersion(), fingerprint, fontCss }, photos);
  return { key, data, doc, html: renderOwnerReportHtml(doc), fingerprint };
}
