/**
 * Send bill: sale → bill doc → HTML → A5 PDF → WhatsApp (the customer's chat when we have
 * their number, else the share sheet) → a 'bill' report record. Device services are passed
 * in (`BillDeps`) so the flow runs in Node tests.
 */
import { createReportRecord, markSent } from '@/db/repo/reports';
import { getSale } from '@/db/repo/saleQueries';
import { getShopInfo } from '@/db/repo/shopInfo';
import type { DbOrTx } from '@/db/types';
import { billDocFromSale } from '@/pdf/adapters';
import { billFileBaseName } from '@/pdf/fileNames';
import { renderBillHtml } from '@/pdf/templates/bill';
import { billMessage } from '@/pdf/text';
import type { ShareFileOptions, ShareResult } from '@/share/whatsapp';

export type BillDeps = {
  getPdfFontCss: () => Promise<string>;
  renderPdf: (html: string, options: { fileBaseName: string; page?: 'A4' | 'A5' }) => Promise<{ uri: string }>;
  shareFileToWhatsApp: (opts: ShareFileOptions) => Promise<ShareResult>;
};

export type BillOutcome =
  | { status: 'sent' | 'fallback_shared' | 'dismissed' | 'unavailable' | 'error'; hadPhone: boolean }
  | { status: 'not_found' | 'render_failed'; hadPhone: boolean };

function fileNameOf(uri: string): string {
  const last = uri.split('/').pop() ?? uri;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

export async function sendBill(database: DbOrTx, saleId: string, deps: BillDeps, now: () => number = Date.now): Promise<BillOutcome> {
  const detail = getSale(database, saleId);
  if (!detail) return { status: 'not_found', hadPhone: false };
  const phone = detail.sale.customerPhoneSnapshot ?? (detail.customer?.deletedAt == null ? (detail.customer?.phone ?? null) : null);
  const shop = getShopInfo(database);

  let uri: string;
  let message: string;
  try {
    const doc = billDocFromSale(detail, shop, await deps.getPdfFontCss());
    message = billMessage(doc);
    const pdf = await deps.renderPdf(renderBillHtml(doc), { fileBaseName: billFileBaseName(detail.sale.billNo, shop.shopName), page: 'A5' });
    uri = pdf.uri;
  } catch {
    return { status: 'render_failed', hadPhone: !!phone };
  }

  const result = await deps.shareFileToWhatsApp({ fileUri: uri, mimeType: 'application/pdf', phoneE164: phone, message, filename: fileNameOf(uri) });
  if (result.status === 'sent' || result.status === 'fallback_shared') {
    try {
      const at = now();
      const { id } = createReportRecord(
        database,
        {
          kind: 'bill',
          fileName: fileNameOf(uri),
          customerId: detail.sale.customerId,
          summary: { saleId, billNo: detail.sale.billNo, totalPaise: detail.sale.totalPaise },
        },
        at,
      );
      markSent(database, id, at);
    } catch {
      // The bill already reached WhatsApp; a missing history row must not turn that into an error.
    }
  }
  return { status: result.status, hadPhone: !!phone };
}
