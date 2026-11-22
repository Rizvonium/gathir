import { backupReminderAt, estimateBackupBytes, outcomeToParams, paramsToOutcome, plainCounts } from '../backupView';

describe('backupView', () => {
  it('turns manifest counts into plain counts', () => {
    expect(plainCounts({ tables: { products: 21, sales: 40, customers: 12 }, photoFiles: 125 })).toEqual({ designs: 21, sales: 40, customers: 12, photos: 63 });
    expect(plainCounts({ tables: {}, photoFiles: 0 })).toEqual({ designs: 0, sales: 0, customers: 0, photos: 0 });
  });

  it('round-trips the result route params', () => {
    const ok = { kind: 'ok' as const, counts: { designs: 3, sales: 2, customers: 1, photos: 6 } };
    expect(paramsToOutcome(outcomeToParams(ok))).toEqual(ok);
    expect(paramsToOutcome(outcomeToParams({ kind: 'newer_version' }))).toEqual({ kind: 'newer_version' });
  });

  it('never reads an unknown status as success', () => {
    expect(paramsToOutcome({ status: 'hacked' })).toEqual({ kind: 'failed' });
    expect(paramsToOutcome({})).toEqual({ kind: 'failed' });
    expect(paramsToOutcome({ status: 'ok', designs: '-4', sales: 'x' })).toEqual({ kind: 'ok', counts: { designs: 0, sales: 0, customers: 0, photos: 0 } });
  });

  it('estimates the backup size from photos and data', () => {
    expect(estimateBackupBytes({ photosBytes: 1000, dbBytes: 50 })).toBe(1200);
  });

  it('reminds a week later at 11:00', () => {
    const at = backupReminderAt(new Date(2026, 10, 22, 21, 30).getTime());
    expect(new Date(at)).toEqual(new Date(2026, 10, 29, 11, 0, 0, 0));
  });
});
