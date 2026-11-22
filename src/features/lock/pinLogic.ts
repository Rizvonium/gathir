/**
 * App lock rules (PLAN §3 Safety, §15 DPDP risk). Pure: no expo imports, so it runs in Node tests.
 * The PIN is never stored: only SHA-256(salt + ":" + pin) and a random salt, in secure storage.
 */
import { SHOWROOM_LEAVE_PATH } from '@/features/showroom/logic/leave';

export const PIN_LENGTH = 4;
/** Wrong PINs allowed before a pause. */
export const MAX_TRIES = 5;
/** Pause after MAX_TRIES wrong PINs. */
export const LOCKOUT_MS = 30_000;
/** Coming back after this long in the background asks for the PIN again. */
export const BACKGROUND_LOCK_MS = 5 * 60_000;

export type Sha256 = (text: string) => Promise<string>;

export type StoredPin = { v: 1; salt: string; hash: string };

/** Hex SHA-256 of salt + pin. The digest function is injected (expo-crypto on the phone). */
export function hashPin(pin: string, salt: string, sha256: Sha256): Promise<string> {
  return sha256(`${salt}:${pin}`);
}

export function isCompletePin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/** Bytes → lowercase hex (for the salt). */
export function toHex(bytes: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += (bytes[i] & 0xff).toString(16).padStart(2, '0');
  return out;
}

/** Parses the secure-store value; null when missing or damaged. */
export function parseStoredPin(raw: string | null): StoredPin | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredPin>;
    if (v && v.v === 1 && typeof v.salt === 'string' && typeof v.hash === 'string' && v.salt && v.hash) return v as StoredPin;
  } catch {
    // damaged value: treat as no PIN
  }
  return null;
}

/** Constant-time-ish string compare (avoids early exit on the first different character). */
export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ───────────── Wrong-PIN counting and the 30 s pause ───────────── */

export type Attempts = { fails: number; lockedUntil: number | null };
export const NO_ATTEMPTS: Attempts = { fails: 0, lockedUntil: null };

export function parseAttempts(raw: string | null): Attempts {
  if (!raw) return NO_ATTEMPTS;
  try {
    const v = JSON.parse(raw) as Partial<Attempts>;
    const fails = typeof v.fails === 'number' && v.fails >= 0 ? Math.floor(v.fails) : 0;
    const lockedUntil = typeof v.lockedUntil === 'number' ? v.lockedUntil : null;
    return { fails, lockedUntil };
  } catch {
    return NO_ATTEMPTS;
  }
}

/** One more wrong PIN. The 5th starts a 30 s pause and resets the count. */
export function registerFailure(a: Attempts, now: number): Attempts {
  const fails = a.fails + 1;
  if (fails >= MAX_TRIES) return { fails: 0, lockedUntil: now + LOCKOUT_MS };
  return { fails, lockedUntil: a.lockedUntil };
}

/** Milliseconds left in the pause (0 when not paused). */
export function lockoutRemaining(a: Attempts, now: number): number {
  if (a.lockedUntil === null) return 0;
  return Math.max(0, a.lockedUntil - now);
}

/** Wrong tries left before the pause. */
export function triesLeft(a: Attempts): number {
  return Math.max(0, MAX_TRIES - a.fails);
}

/* ───────────── Keypad entry ───────────── */

export type PadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'back';

/** Applies one key press. Extra digits after the 4th are ignored. */
export function pressKey(entry: string, key: PadKey): string {
  if (key === 'back') return entry.slice(0, -1);
  if (entry.length >= PIN_LENGTH) return entry;
  return entry + key;
}

/* ───────────── When to lock ───────────── */

/**
 * True when the app-lock gate applies: a PIN is set AND first-launch setup has finished.
 * Onboarding comes first, the lock only after it (no lock over an unfinished setup).
 */
export function lockGateActive(pinSet: boolean, onboarded: boolean): boolean {
  return pinSet && onboarded;
}

/** True when the app was in the background long enough to ask for the PIN again. */
export function shouldLockOnResume(backgroundAt: number | null, now: number): boolean {
  return backgroundAt !== null && now - backgroundAt > BACKGROUND_LOCK_MS;
}

/** Whole seconds for "Try again in 27 s". */
export function secondsLeft(ms: number): number {
  return Math.ceil(ms / 1000);
}

/** Only internal app paths are allowed as a return target (no schemes, no "//host"). */
export function safeReturnTo(value: string | string[] | undefined | null): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || typeof v !== 'string') return null;
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('://')) return null;
  return v;
}

/**
 * Return targets that must not be skipped around: the lock screen in front of them stays put on
 * Android back (only its close button leaves). Today: leaving the customer-facing Showroom.
 */
export const BACK_GUARDED_RETURNS: readonly string[] = [SHOWROOM_LEAVE_PATH];

/** True when Android back must be blocked on /lock (verify mode guarding a protected return). */
export function lockBlocksBack(mode: 'set' | 'verify' | 'change', returnTo: string | string[] | undefined | null): boolean {
  const target = safeReturnTo(returnTo);
  if (mode !== 'verify' || !target) return false;
  const path = target.split('?')[0];
  return BACK_GUARDED_RETURNS.includes(path);
}
