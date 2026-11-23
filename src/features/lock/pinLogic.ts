/**
 * App lock rules (PLAN §3 Safety, §15 DPDP risk). Pure: no expo imports, so it runs in Node tests.
 * The PIN is never stored: only SHA-256(salt + ":" + pin) and a random salt, in secure storage.
 */
import { SHOWROOM_LEAVE_PATH } from '@/features/showroom/logic/leave';

export const PIN_LENGTH = 4;
/** Wrong PINs allowed before a pause. */
export const MAX_TRIES = 5;
/** Pause after the first MAX_TRIES wrong PINs. */
export const LOCKOUT_MS = 30_000;
/**
 * Each further round of MAX_TRIES wrong PINs (with no correct PIN or fingerprint between) pauses
 * longer, up to an hour a round: guessing all 10,000 PINs then takes months, not one night.
 */
export const LOCKOUT_STEPS_MS: readonly number[] = [LOCKOUT_MS, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
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

/**
 * `fails`: wrong PINs in the current round; `rounds`: pauses already served since the last
 * correct PIN or fingerprint (only those reset it, so the pause keeps growing).
 */
export type Attempts = { fails: number; lockedUntil: number | null; rounds: number };
export const NO_ATTEMPTS: Attempts = { fails: 0, lockedUntil: null, rounds: 0 };

export function parseAttempts(raw: string | null): Attempts {
  if (!raw) return NO_ATTEMPTS;
  try {
    const v = JSON.parse(raw) as Partial<Attempts>;
    const fails = typeof v.fails === 'number' && v.fails >= 0 ? Math.floor(v.fails) : 0;
    const lockedUntil = typeof v.lockedUntil === 'number' ? v.lockedUntil : null;
    const rounds = typeof v.rounds === 'number' && v.rounds >= 0 ? Math.floor(v.rounds) : 0;
    return { fails, lockedUntil, rounds };
  } catch {
    return NO_ATTEMPTS;
  }
}

/** Length of the pause after `round` earlier pauses (30 s, 1 min, 5 min, 15 min, then 1 h each). */
export function lockoutFor(round: number): number {
  return LOCKOUT_STEPS_MS[Math.min(Math.max(0, round), LOCKOUT_STEPS_MS.length - 1)];
}

/** One more wrong PIN. Every 5th starts a pause (longer each round) and resets the round count. */
export function registerFailure(a: Attempts, now: number): Attempts {
  const fails = a.fails + 1;
  if (fails >= MAX_TRIES) return { fails: 0, lockedUntil: now + lockoutFor(a.rounds), rounds: a.rounds + 1 };
  return { fails, lockedUntil: a.lockedUntil, rounds: a.rounds };
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

/** Whole minutes for "Try again in 14 min" (pauses longer than 90 s). */
export function minutesLeft(ms: number): number {
  return Math.ceil(ms / 60_000);
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

/**
 * The mode the lock screen really runs in. Asking to *set* a PIN when one already exists becomes
 * *change*, so the current PIN is always needed to replace it (a link to /lock?mode=set included).
 */
export function effectiveLockMode(mode: 'set' | 'verify' | 'change', pinExists: boolean): 'set' | 'verify' | 'change' {
  return mode === 'set' && pinExists ? 'change' : mode;
}

/** True when Android back must be blocked on /lock (verify mode guarding a protected return). */
export function lockBlocksBack(mode: 'set' | 'verify' | 'change', returnTo: string | string[] | undefined | null): boolean {
  const target = safeReturnTo(returnTo);
  if (mode !== 'verify' || !target) return false;
  const path = target.split('?')[0];
  return BACK_GUARDED_RETURNS.includes(path);
}
