import { createReportRecord, listReports, markSent } from '@/db/repo/reports';
import { createSale } from '@/db/repo/sales';
import { updateSettings } from '@/db/repo/settings';
import { addDays, endOfDay, startOfDay, startOfMonth, startOfWeek } from '@/lib/dates';
import { createTestDb } from '@/test/testDb';

import { addTestProduct, T0 } from '@/db/__tests__/fixtures';

import { parseSummary, sentReports, summaryOf } from '../history';
import { daysCovered, isDayInRange, pickCustomDay, recentDays, resolvePeriod } from '../period';
import { previewHtml } from '../previewHtml';
import { readRangeSummary, readReportBasics, shopStart } from '../reportData';
import { fullPhotoNames, outcomeOf } from '../sendOutcome';
import { reportKey, salesStamp } from '../store';

jest.mock('zustand', () => ({ create: () => () => ({}) }));

const NOW = T0;
const since = { from: NOW - 5 * 86_400_000, to: NOW };

describe('period', () => {
  it('resolves each period kind', () => {
    const base = { now: NOW, sinceLast: since, customFrom: null, customTo: null };
    expect(resolvePeriod({ ...base, kind: 'since' })).toEqual(since);
    expect(resolvePeriod({ ...base, kind: 'today' })).toEqual({ from: startOfDay(NOW), to: NOW });
    expect(resolvePeriod({ ...base, kind: 'week' })).toEqual({ from: startOfWeek(NOW), to: NOW });
    expect(resolvePeriod({ ...base, kind: 'month' })).toEqual({ from: startOfMonth(NOW), to: NOW });
  });

  it('custom range: ordered, whole days, never past now', () => {
    const d1 = startOfDay(addDays(NOW, -3));
    const d2 = startOfDay(addDays(NOW, -1));
    expect(resolvePeriod({ kind: 'custom', now: NOW, sinceLast: since, customFrom: d2, customTo: d1 })).toEqual({ from: d1, to: endOfDay(d2) });
    const today = startOfDay(NOW);
    expect(resolvePeriod({ kind: 'custom', now: NOW, sinceLast: since, customFrom: today, customTo: today }).to).toBe(NOW);
  });

  it('day chips: first tap = one day, second extends, third starts over', () => {
    const a = startOfDay(addDays(NOW, -4));
    const b = startOfDay(addDays(NOW, -1));
    const one = pickCustomDay({ from: null, to: null }, a);
    expect(one).toEqual({ from: a, to: a });
    const range = pickCustomDay(one, b);
    expect(range).toEqual({ from: a, to: b });
    expect(pickCustomDay(range, b)).toEqual({ from: b, to: b });
    expect(pickCustomDay({ from: b, to: b }, a)).toEqual({ from: a, to: b });
    expect(isDayInRange(startOfDay(addDays(NOW, -2)), a, b)).toBe(true);
    expect(isDayInRange(startOfDay(NOW), a, b)).toBe(false);
    expect(recentDays(NOW, 3)).toHaveLength(4);
    expect(daysCovered({ from: a, to: endOfDay(b) })).toBe(4);
  });
});

describe('send outcome', () => {
  it('marks sent only when WhatsApp or the share sheet took the file', () => {
    expect(outcomeOf('sent')).toEqual({ kind: 'sent', markSent: true });
    expect(outcomeOf('fallback_shared')).toEqual({ kind: 'shared', markSent: true });
    expect(outcomeOf('dismissed')).toEqual({ kind: 'not_sent', markSent: false });
    expect(outcomeOf('unavailable').markSent).toBe(false);
    expect(outcomeOf('error').markSent).toBe(false);
  });

  it('maps thumbnails to unique full photos', () => {
    expect(fullPhotoNames(['a_thumb.jpg', 'a_thumb.jpg', null, 'b.jpg'], '_thumb.jpg')).toEqual(['a.jpg', 'b.jpg']);
  });

  it('keys change with range, phones and stamp', () => {
    const r = { from: 1, to: 2 };
    expect(reportKey(r, true, 'x')).not.toBe(reportKey(r, false, 'x'));
    expect(salesStamp({ count: 2, pieces: 3, amountPaise: 400 })).toBe('2:3:400');
  });
});

describe('history', () => {
  it('lists only sent owner reports, newest first, with safe summaries', () => {
    const db = createTestDb();
    const a = createReportRecord(db, { kind: 'owner', periodFrom: 1, periodTo: 2, summary: summaryOf({ summary: { count: 2, pieces: 3, amountPaise: 900 } }, 1234) }, T0);
    const b = createReportRecord(db, { kind: 'owner', periodFrom: 3, periodTo: 4 }, T0);
    createReportRecord(db, { kind: 'owner', periodFrom: 5, periodTo: 6 }, T0);
    markSent(db, a.id, T0 + 10);
    markSent(db, b.id, T0 + 20);
    const rows = sentReports(listReports(db, 'owner'));
    expect(rows.map((r) => r.id)).toEqual([b.id, a.id]);
    expect(rows[1].summary).toEqual({ saleCount: 2, pieces: 3, amountPaise: 900, sizeBytes: 1234 });
    expect(parseSummary('not json')).toEqual({ saleCount: 0, pieces: 0, amountPaise: 0 });
  });
});

describe('reportData', () => {
  it('reads owner number, phones setting and the since-last range', () => {
    const db = createTestDb();
    updateSettings(db, { ownerWhatsapp: '+919906000999', reportIncludesCustomerPhones: false }, T0);
    const b = readReportBasics(db, T0);
    expect(b.ownerWhatsapp).toBe('+919906000999');
    expect(b.includeCustomerPhones).toBe(false);
    expect(b.lastSentAt).toBeNull();
    expect(b.sinceLast.to).toBe(T0);
  });

  it('starts "since last report" at the first sale, and sums a range', () => {
    const db = createTestDb();
    const p = addTestProduct(db, { at: T0 - 10 * 86_400_000 });
    createSale(db, { items: [{ colourId: p.colourIds[0], qty: 2, ratePaise: 500_000 }], payment: 'cash' }, T0 - 2 * 86_400_000);
    expect(shopStart(db, T0)).toBe(T0 - 2 * 86_400_000);
    const sum = readRangeSummary(db, { from: T0 - 3 * 86_400_000, to: T0 });
    expect(sum.pieces).toBe(2);
    expect(sum.amountPaise).toBe(1_000_000);
  });
});

describe('previewHtml', () => {
  it('fits the page width and adds the page well, leaving the body alone', () => {
    const out = previewHtml('<html><head><meta name="viewport" content="width=device-width"></head><body><main><div class="page">x</div></main></body></html>', {
      background: '#eee',
      shadow: 'rgba(0,0,0,.2)',
    });
    expect(out).toContain('width=860');
    expect(out).not.toContain('device-width');
    expect(out).toContain('gathir-preview');
    expect(out).toContain('<div class="page">x</div>');
  });
});

describe('buying price & profit in owner reports (setting)', () => {
  it('is off by default and read live from settings', () => {
    const db = createTestDb();
    expect(readReportBasics(db, T0).includeProfit).toBe(false);
    updateSettings(db, { reportIncludesProfit: true });
    expect(readReportBasics(db, T0).includeProfit).toBe(true);
  });

  it('a prepared PDF is not reused after the profit setting changes', () => {
    const r = { from: 1, to: 2 };
    expect(reportKey(r, true, 'x', false)).toBe(reportKey(r, true, 'x'));
    expect(reportKey(r, true, 'x', true)).not.toBe(reportKey(r, true, 'x', false));
  });
});
