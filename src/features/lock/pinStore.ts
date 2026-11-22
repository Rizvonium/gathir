/**
 * Device side of the app lock: PIN hash in expo-secure-store (Android Keystore), SHA-256 with
 * expo-crypto, fingerprint with expo-local-authentication. The DB only keeps the
 * `settings.pinHashSet` flag (so backups never carry the PIN).
 * Other features (e.g. Showroom exit) can call `verifyPin` / `isPinStored` / `unlockWithFingerprint`.
 */
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import {
  NO_ATTEMPTS,
  hashPin,
  isCompletePin,
  lockoutRemaining,
  parseAttempts,
  parseStoredPin,
  registerFailure,
  sameHash,
  toHex,
  type Attempts,
} from './pinLogic';

const PIN_KEY = 'gathir.pin.v1';
const ATTEMPTS_KEY = 'gathir.pin.attempts';

const sha256 = (text: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text, { encoding: Crypto.CryptoEncoding.HEX });

export async function isPinStored(): Promise<boolean> {
  try {
    return parseStoredPin(await SecureStore.getItemAsync(PIN_KEY)) !== null;
  } catch {
    return false;
  }
}

/** Saves a new PIN (random 16-byte salt). Throws if secure storage fails. */
export async function savePin(pin: string): Promise<void> {
  if (!isCompletePin(pin)) throw new Error('PIN must be 4 digits');
  const salt = toHex(Crypto.getRandomBytes(16));
  const hash = await hashPin(pin, salt, sha256);
  await SecureStore.setItemAsync(PIN_KEY, JSON.stringify({ v: 1, salt, hash }));
  await writeAttempts(NO_ATTEMPTS);
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
  await writeAttempts(NO_ATTEMPTS);
}

export async function readAttempts(): Promise<Attempts> {
  try {
    return parseAttempts(await SecureStore.getItemAsync(ATTEMPTS_KEY));
  } catch {
    return NO_ATTEMPTS;
  }
}

async function writeAttempts(a: Attempts): Promise<void> {
  try {
    await SecureStore.setItemAsync(ATTEMPTS_KEY, JSON.stringify(a));
  } catch {
    // Counting is best-effort; the PIN check itself still works.
  }
}

export type VerifyResult =
  | { status: 'ok' }
  | { status: 'wrong'; attempts: Attempts }
  | { status: 'locked'; remainingMs: number; attempts: Attempts }
  | { status: 'no_pin' };

/** Checks a PIN, counting wrong tries (5 wrong → 30 s pause, kept across restarts). */
export async function verifyPin(pin: string, now: number = Date.now()): Promise<VerifyResult> {
  const attempts = await readAttempts();
  const remaining = lockoutRemaining(attempts, now);
  if (remaining > 0) return { status: 'locked', remainingMs: remaining, attempts };
  let stored;
  try {
    stored = parseStoredPin(await SecureStore.getItemAsync(PIN_KEY));
  } catch {
    stored = null;
  }
  if (!stored) return { status: 'no_pin' };
  const hash = await hashPin(pin, stored.salt, sha256);
  if (sameHash(hash, stored.hash)) {
    await writeAttempts(NO_ATTEMPTS);
    return { status: 'ok' };
  }
  const next = registerFailure({ ...attempts, lockedUntil: null }, now);
  await writeAttempts(next);
  const left = lockoutRemaining(next, now);
  return left > 0 ? { status: 'locked', remainingMs: left, attempts: next } : { status: 'wrong', attempts: next };
}

/** True when the phone has a fingerprint (or other biometric) set up. */
export async function canUseFingerprint(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Shows the system fingerprint prompt. Resolves true only on success (never throws). */
export async function unlockWithFingerprint(labels: { prompt: string; cancel: string; usePin: string }): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: labels.prompt,
      cancelLabel: labels.cancel,
      fallbackLabel: labels.usePin,
      // Our own PIN is the fallback, not the phone's screen lock.
      disableDeviceFallback: true,
    });
    if (result.success) await writeAttempts(NO_ATTEMPTS);
    return result.success;
  } catch {
    return false;
  }
}
