import { createHash } from 'node:crypto';

import {
  BACKGROUND_LOCK_MS,
  LOCKOUT_MS,
  MAX_TRIES,
  NO_ATTEMPTS,
  hashPin,
  isCompletePin,
  lockGateActive,
  lockoutRemaining,
  parseAttempts,
  parseStoredPin,
  pressKey,
  lockoutFor,
  registerFailure,
  safeReturnTo,
  lockBlocksBack,
  sameHash,
  secondsLeft,
  shouldLockOnResume,
  toHex,
  triesLeft,
} from '../pinLogic';

const sha256 = async (s: string) => createHash('sha256').update(s).digest('hex');

describe('pinLogic', () => {
  it('hashes with the salt and compares safely', async () => {
    const a = await hashPin('1234', 'aa', sha256);
    expect(a).toBe(await sha256('aa:1234'));
    expect(a).not.toBe(await hashPin('1234', 'bb', sha256));
    expect(sameHash(a, a)).toBe(true);
    expect(sameHash(a, a.slice(1))).toBe(false);
    expect(toHex([0, 15, 255])).toBe('000fff');
  });

  it('only accepts 4 digits', () => {
    expect(isCompletePin('1234')).toBe(true);
    expect(isCompletePin('123')).toBe(false);
    expect(isCompletePin('12a4')).toBe(false);
  });

  it('parses stored values defensively', () => {
    expect(parseStoredPin(null)).toBeNull();
    expect(parseStoredPin('{bad')).toBeNull();
    expect(parseStoredPin(JSON.stringify({ v: 1, salt: 's', hash: 'h' }))).toEqual({ v: 1, salt: 's', hash: 'h' });
    expect(parseAttempts('nope')).toEqual(NO_ATTEMPTS);
    expect(parseAttempts(JSON.stringify({ fails: 2.7, lockedUntil: 5 }))).toEqual({ fails: 2, lockedUntil: 5, rounds: 0 });
    expect(parseAttempts(JSON.stringify({ fails: 1, lockedUntil: null, rounds: 3 }))).toEqual({ fails: 1, lockedUntil: null, rounds: 3 });
  });

  it('pauses for 30 s after 5 wrong PINs', () => {
    let a = NO_ATTEMPTS;
    for (let i = 0; i < MAX_TRIES - 1; i++) a = registerFailure(a, 1000);
    expect(triesLeft(a)).toBe(1);
    expect(lockoutRemaining(a, 1000)).toBe(0);
    a = registerFailure(a, 1000);
    expect(lockoutRemaining(a, 1000)).toBe(LOCKOUT_MS);
    expect(secondsLeft(lockoutRemaining(a, 1000 + 2500))).toBe(28);
    expect(lockoutRemaining(a, 1000 + LOCKOUT_MS)).toBe(0);
  });

  it('makes each further pause longer until a correct PIN, up to an hour (no overnight brute force)', () => {
    let a = NO_ATTEMPTS;
    let t = 0;
    const pauses: number[] = [];
    for (let round = 0; round < 7; round++) {
      for (let i = 0; i < MAX_TRIES; i++) a = registerFailure({ ...a, lockedUntil: null }, t);
      pauses.push(lockoutRemaining(a, t));
      t += lockoutRemaining(a, t);
    }
    expect(pauses).toEqual([30_000, 60_000, 300_000, 900_000, 3_600_000, 3_600_000, 3_600_000]);
    expect(lockoutFor(99)).toBe(3_600_000);
    // 10,000 PINs at 5 per hour is far more than a night at the counter.
    expect((10_000 / MAX_TRIES) * lockoutFor(99)).toBeGreaterThan(30 * 24 * 3_600_000);
    // Only a correct PIN (NO_ATTEMPTS) starts again from 30 s.
    a = NO_ATTEMPTS;
    for (let i = 0; i < MAX_TRIES; i++) a = registerFailure(a, t);
    expect(lockoutRemaining(a, t)).toBe(LOCKOUT_MS);
  });

  it('keypad: backspace and no 5th digit', () => {
    expect(pressKey('12', '3')).toBe('123');
    expect(pressKey('1234', '5')).toBe('1234');
    expect(pressKey('12', 'back')).toBe('1');
    expect(pressKey('', 'back')).toBe('');
  });

  it('locks again only after more than 5 minutes away', () => {
    expect(shouldLockOnResume(null, 10)).toBe(false);
    expect(shouldLockOnResume(0, BACKGROUND_LOCK_MS)).toBe(false);
    expect(shouldLockOnResume(0, BACKGROUND_LOCK_MS + 1)).toBe(true);
  });

  it('lock gate applies only after onboarding finished', () => {
    expect(lockGateActive(true, true)).toBe(true);
    expect(lockGateActive(true, false)).toBe(false);
    expect(lockGateActive(false, true)).toBe(false);
  });

  it('only returns to internal paths', () => {
    expect(safeReturnTo('/report')).toBe('/report');
    expect(safeReturnTo(['/more', '/x'])).toBe('/more');
    expect(safeReturnTo('https://evil.example')).toBeNull();
    expect(safeReturnTo('//evil')).toBeNull();
    expect(safeReturnTo(undefined)).toBeNull();
  });

  it('blocks Android back on /lock only when verifying for a guarded return (Showroom exit)', () => {
    expect(lockBlocksBack('verify', '/showroom/leave')).toBe(true);
    expect(lockBlocksBack('verify', ['/showroom/leave'])).toBe(true);
    expect(lockBlocksBack('verify', '/report')).toBe(false);
    expect(lockBlocksBack('verify', undefined)).toBe(false);
    expect(lockBlocksBack('set', '/showroom/leave')).toBe(false);
    expect(lockBlocksBack('change', '/showroom/leave')).toBe(false);
    expect(lockBlocksBack('verify', 'https://evil.example/showroom/leave')).toBe(false);
  });
});
