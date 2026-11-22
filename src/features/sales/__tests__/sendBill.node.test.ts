import { addTestProduct, T0 } from '@/db/__tests__/fixtures';
import { listReports } from '@/db/repo/reports';
import { createSale } from '@/db/repo/sales';
import { createTestDb } from '@/test/testDb';

import { sendBill, type BillDeps } from '../logic/sendBill';

function deps(status: 'sent' | 'dismissed' | 'fallback_shared' = 'sent') {
  const d = {
    getPdfFontCss: jest.fn(async () => '/*fonts*/'),
    renderPdf: jest.fn(async () => ({ uri: 'file:///cache/exports/Bill%20B-2026-0001.pdf' })),
    shareFileToWhatsApp: jest.fn(async () => ({ status })),
  };
  return d as typeof d & BillDeps;
}

function setup(customer?: { name: string; phone?: string }) {
  const db = createTestDb();
  const { colourIds } = addTestProduct(db, { name: 'Kani shawl' });
  const { saleId, billNo } = createSale(db, { items: [{ colourId: colourIds[0], qty: 1, ratePaise: 650_000 }], newCustomer: customer }, T0);
  return { db, saleId, billNo };
}

describe('sendBill', () => {
  it("renders an A5 bill, opens the customer's WhatsApp chat and records a sent bill", async () => {
    const { db, saleId, billNo } = setup({ name: 'Rukhsana', phone: '98765 43210' });
    const d = deps('sent');
    const out = await sendBill(db, saleId, d, () => T0 + 5);
    expect(out).toEqual({ status: 'sent', hadPhone: true });
    expect(d.renderPdf).toHaveBeenCalledWith(expect.stringContaining(billNo), expect.objectContaining({ page: 'A5' }));
    expect(d.shareFileToWhatsApp).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'application/pdf', phoneE164: '+919876543210', filename: 'Bill B-2026-0001.pdf', message: expect.stringContaining(billNo) }),
    );
    const [report] = listReports(db, 'bill');
    expect(report).toMatchObject({ kind: 'bill', sentAt: T0 + 5, fileName: 'Bill B-2026-0001.pdf' });
    expect(JSON.parse(report.summaryJson)).toMatchObject({ saleId, billNo });
  });

  it('uses the share sheet for a walk-in sale and records nothing when dismissed', async () => {
    const { db, saleId } = setup();
    const d = deps('dismissed');
    expect(await sendBill(db, saleId, d)).toEqual({ status: 'dismissed', hadPhone: false });
    expect(d.shareFileToWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ phoneE164: null }));
    expect(listReports(db, 'bill')).toEqual([]);
  });

  it('reports a render failure and a missing sale without throwing', async () => {
    const { db, saleId } = setup();
    const d = deps();
    d.renderPdf.mockRejectedValueOnce(new Error('print failed'));
    expect((await sendBill(db, saleId, d)).status).toBe('render_failed');
    expect(d.shareFileToWhatsApp).not.toHaveBeenCalled();
    expect((await sendBill(db, 'nope', d)).status).toBe('not_found');
  });
});
