/**
 * "Send to owner on WhatsApp" (PLAN §7): PDF → report record → WhatsApp straight into the
 * owner's chat → when the seller is back, "Marked as sent ✓" with Undo and a celebration.
 * Backing out marks nothing. A retry after backing out reuses the same PDF and report number.
 */
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useDbVersion } from '@/db/hooks';
import { createReportRecord, markSent, unmarkSent } from '@/db/repo/reports';
import { photoFile } from '@/lib/files';
import { photoUri, THUMB_SUFFIX } from '@/lib/photos';
import { ownerReportFileBaseName, ownerReportMessage, renderPdf } from '@/pdf';
import { shareFileToWhatsApp, shareImagesToWhatsApp } from '@/share';
import { playHaptic, useToast } from '@/ui/components';

import { summaryOf } from '../history';
import { prepareOwnerReport } from '../prepare';
import { fullPhotoNames, outcomeOf } from '../sendOutcome';
import { reportKey, salesStamp, useReportFlow, type PendingSend } from '../store';
import type { ReportPeriod } from './useReportPeriod';

function fileNameOf(uri: string): string {
  const parts = uri.split('/');
  return decodeURIComponent(parts[parts.length - 1] ?? '');
}

function photoExists(name: string): boolean {
  try {
    return photoFile(name).exists;
  } catch {
    return false;
  }
}

export function useReportSend(p: ReportPeriod, { fromPreview = false }: { fromPreview?: boolean } = {}) {
  const { t } = useTranslation('report');
  const toast = useToast();
  const version = useDbVersion();
  const flow = useReportFlow();
  const [needOwner, setNeedOwner] = useState(false);
  const owner = p.basics.ownerWhatsapp;
  const busy = flow.phase !== 'idle';

  const undo = (reportId: string) => {
    try {
      unmarkSent(db, reportId);
      useReportFlow.getState().set({ sent: null });
      toast.show({ message: t('send.undone') });
    } catch {
      toast.show({ message: t('send.undoFailed'), tone: 'danger' });
    }
  };

  /** Re-uses a recorded-but-unsent PDF for the same content, else makes and records a new one. */
  const pdfFor = async (): Promise<PendingSend> => {
    const pendingKey = reportKey(p.range, p.includePhones, salesStamp(p.summary), p.includeProfit);
    const state = useReportFlow.getState();
    if (state.pending?.key === pendingKey && new File(state.pending.pdfUri).exists) return state.pending;

    const previewKey = reportKey(p.range, p.includePhones, version, p.includeProfit);
    const prepared = state.prepared?.key === previewKey ? state.prepared : await prepareOwnerReport(p.range, p.includePhones, previewKey, p.now);
    const at = Date.now();
    const pdf = await renderPdf(prepared.html, { fileBaseName: ownerReportFileBaseName(prepared.data.shop.shopName, prepared.data.reportNumber, at) });
    const fileName = fileNameOf(pdf.uri);
    const rec = createReportRecord(db, {
      kind: 'owner',
      periodFrom: p.range.from,
      periodTo: p.range.to,
      fileName,
      summary: summaryOf(prepared.data, pdf.sizeBytes),
      fingerprint: prepared.fingerprint,
    });
    const pending: PendingSend = {
      key: pendingKey,
      reportId: rec.id,
      number: rec.number,
      pdfUri: pdf.uri,
      fileName,
      doc: prepared.doc,
      photoThumbs: prepared.data.sales.flatMap((s) => s.items.map((i) => i.photoName)),
    };
    useReportFlow.getState().set({ pending, prepared });
    return pending;
  };

  const send = async () => {
    if (busy) return;
    if (!owner) {
      setNeedOwner(true);
      return;
    }
    flow.set({ phase: 'preparing' });
    let pending: PendingSend;
    try {
      pending = await pdfFor();
    } catch {
      flow.set({ phase: 'idle' });
      playHaptic('error');
      toast.show({ message: t('send.makeFailed'), tone: 'danger' });
      return;
    }

    flow.set({ phase: 'sharing' });
    const result = await shareFileToWhatsApp({
      fileUri: pending.pdfUri,
      mimeType: 'application/pdf',
      phoneE164: owner,
      message: ownerReportMessage(pending.doc),
      dialogTitle: t('send.dialogTitle'),
      filename: pending.fileName,
    });
    const outcome = outcomeOf(result.status);
    flow.set({ phase: 'idle' });

    if (!outcome.markSent) {
      if (outcome.kind === 'not_sent') {
        toast.show({ message: t('send.notSent') });
      } else {
        playHaptic('error');
        toast.show({ message: t('send.failed'), tone: 'danger', actionLabel: t('common:actions.retry'), onAction: () => void send() });
      }
      return;
    }

    try {
      markSent(db, pending.reportId);
    } catch {
      toast.show({ message: t('send.markFailed'), tone: 'danger' });
      return;
    }
    flow.set({
      pending: null,
      celebrate: true,
      sent: {
        reportId: pending.reportId,
        number: pending.number,
        saleCount: pending.doc.summary.saleCount,
        amountPaise: pending.doc.summary.amountPaise,
        photoNames: fullPhotoNames(pending.photoThumbs, THUMB_SUFFIX).filter(photoExists),
        ownerPhone: owner,
      },
    });
    playHaptic('success');
    toast.show({
      message: outcome.kind === 'shared' ? t('send.sharedMarked') : t('send.marked'),
      tone: 'success',
      actionLabel: t('common:actions.undo'),
      onAction: () => undo(pending.reportId),
    });
    if (fromPreview && router.canGoBack()) router.back();
  };

  const sendPhotos = async () => {
    const sent = useReportFlow.getState().sent;
    if (!sent || sent.photoNames.length === 0 || busy) return;
    flow.set({ phase: 'photos' });
    const r = await shareImagesToWhatsApp({
      urls: sent.photoNames.map(photoUri),
      phoneE164: sent.ownerPhone,
      message: t('photos.caption', { number: sent.number }),
    });
    flow.set({ phase: 'idle' });
    if (r.status === 'sent') {
      playHaptic('success');
      toast.show({ message: t('photos.sent', { count: sent.photoNames.length }), tone: 'success' });
    } else if (r.status === 'dismissed') {
      toast.show({ message: r.batchesSent > 0 ? t('photos.partly', { sent: r.batchesSent, total: r.batches }) : t('photos.notSent') });
    } else {
      playHaptic('error');
      toast.show({ message: t('photos.failed'), tone: 'danger' });
    }
  };

  return {
    phase: flow.phase,
    busy,
    owner,
    needOwner,
    closeOwnerPrompt: () => setNeedOwner(false),
    send: () => void send(),
    sendPhotos: () => void sendPhotos(),
    sent: flow.sent,
    alsoPhotos: flow.alsoPhotos,
  };
}
