import { renderBillHtml } from '../templates/bill';
import { renderOwnerReportHtml } from '../templates/ownerReport';
import { bill, ownerReport } from './fixtures';

describe('owner report', () => {
  const html = renderOwnerReportHtml(ownerReport());

  it('renders all sections in PLAN §7 order', () => {
    const order = ['Summary', 'Every sale', 'Customers this period', 'Stock changes not from sales', 'Current stock', 'Made with Gathir 1.0.0'];
    const positions = order.map((s) => html.indexOf(s));
    expect(positions.every((p) => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
  it('shows summary totals in Indian format', () => {
    expect(html).toContain('₹48,500');
    expect(html).toContain('>7<');
    expect(html).toContain('₹500');
    expect(html).toContain('Cash');
    expect(html).toContain('₹18,500');
    expect(html).not.toMatch(/<td>Card<\/td>/); // payment methods with no bills are left out
    expect(html).toContain('No category');
  });
  it('lists each sale with bill, payment, customer and amounts', () => {
    expect(html).toContain('Bill B-2026-0007 · UPI');
    expect(html).toContain('+91 98111 12222 · Delhi · Regular');
    expect(html).toContain('Total ₹12,500');
    expect(html).toContain('Discount ₹500');
  });
  it('escapes customer names', () => {
    expect(html).not.toContain('<b>Shah</b>');
    expect(html).toContain('Mrs. &lt;b&gt;Shah&lt;/b&gt;');
  });
  it('shows stock changes with reason and signed delta', () => {
    expect(html).toContain('Damaged');
    expect(html).toContain('−1');
    expect(html).toContain('Moth hole');
  });
  it('highlights low and sold-out stock with text, not colour alone', () => {
    expect(html).toContain('<tr class="low">');
    expect(html).toContain('<tr class="out">');
    expect(html).toContain('>Low<');
    expect(html).toContain('>Sold out<');
    expect(html).toContain('₹9,80,000');
  });
  it('prints version, report number and fingerprint in the footer', () => {
    expect(html).toContain('Report no. 12');
    expect(html).toContain('A1B2-C3D4');
  });
  it('handles an empty period', () => {
    const empty = renderOwnerReportHtml(
      ownerReport({
        sales: [],
        stockChanges: [],
        summary: { ...ownerReport().summary, pieces: 0, amountPaise: 0, saleCount: 0, discountsPaise: 0 },
        customers: { newCustomers: [], topBySpend: [], cataloguesSent: 0 },
      }),
    );
    expect(empty).toContain('No sales in this period.');
    expect(empty).toContain('No other stock changes in this period.');
  });
});

describe('bill', () => {
  it('renders header, items, discount, total, payment and UPI', () => {
    const html = renderBillHtml(bill());
    for (const s of ['Kashmir Looms', 'B-2026-0007', 'Mrs. Shah', 'Sozni Stole', '2 × ₹6,500', '₹13,000', '−₹500', '₹12,500', 'Paid by UPI', 'kashmirlooms@upi', 'Thank you']) {
      expect(html).toContain(s);
    }
  });
  it('omits discount rows and UPI when not set, and handles walk-ins', () => {
    const html = renderBillHtml(bill({ discountPaise: 0, totalPaise: 1300000, customer: null, shop: { ...bill().shop, upiId: '' } }));
    expect(html).not.toContain('Subtotal');
    expect(html).not.toContain('UPI ID');
    expect(html).toContain('Walk-in customer');
  });
  it('stamps cancelled bills', () => {
    expect(renderBillHtml(bill({ cancelled: true }))).toContain('class="stamp"');
  });
});
