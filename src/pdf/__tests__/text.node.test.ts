import { billMessage, catalogueMessage, ownerReportMessage } from '../text';
import { bill, catalogue, ownerReport } from './fixtures';

describe('WhatsApp texts', () => {
  it('owner report follows the PLAN §7 format exactly', () => {
    expect(ownerReportMessage(ownerReport())).toBe(
      [
        'Gathir report — Kashmir Looms (Bilal Ahmad)',
        '15 Nov 2026 – 22 Nov 2026',
        'Sold: 7 pieces · ₹48,500',
        'In stock: 63 pieces · 21 designs · 3 low',
        'PDF attached.',
      ].join('\n'),
    );
  });
  it('owner report uses singular forms and drops an empty seller', () => {
    const doc = ownerReport({ summary: { ...ownerReport().summary, pieces: 1 }, totals: { ...ownerReport().totals, totalPieces: 1, designs: 1 } });
    const msg = ownerReportMessage({ ...doc, shop: { ...doc.shop, sellerName: '' } });
    expect(msg.split('\n')[0]).toBe('Gathir report — Kashmir Looms');
    expect(msg).toContain('Sold: 1 piece · ');
    expect(msg).toContain('In stock: 1 piece · 1 design · 3 low');
  });
  it('catalogue message greets the customer and counts visible designs', () => {
    expect(catalogueMessage(catalogue())).toBe(
      [
        'Namaste Mrs. Shah,',
        'Here is our Winter Collection from Kashmir Looms: 2 designs.',
        'Rates valid till 30 Nov 2026.',
        'Reply with the code of any piece you like.',
      ].join('\n'),
    );
  });
  it('catalogue message without rates never mentions rate validity', () => {
    const doc = catalogue({ customerName: null, options: { ...catalogue().options, showRates: false }, part: { index: 1, total: 2 } });
    const msg = catalogueMessage(doc);
    expect(msg).not.toContain('Rates');
    expect(msg).toContain('Namaste,');
    expect(msg).toContain('Part 1 of 2.');
  });
  it('bill message', () => {
    expect(billMessage(bill())).toBe(
      ['Bill B-2026-0007 from Kashmir Looms', '22 Nov 2026 · ₹12,500 (UPI)', 'UPI: kashmirlooms@upi', 'Thank you for shopping with us.'].join('\n'),
    );
  });
});
