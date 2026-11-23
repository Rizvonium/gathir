/** Enter-PIN logic shared by the lock gate, /lock?mode=verify and PIN-protected settings. */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { playHaptic } from '@/ui/components';

import { PIN_LENGTH, lockoutRemaining, minutesLeft, pressKey, secondsLeft, triesLeft, type PadKey } from './pinLogic';
import { canUseFingerprint, readAttempts, unlockWithFingerprint, verifyPin } from './pinStore';

export type PinVerifyState = {
  value: string;
  message: string | undefined;
  messageTone: 'muted' | 'danger';
  /** True while paused after 5 wrong tries, or while checking. */
  disabled: boolean;
  shakeSignal: number;
  fingerprint: boolean;
  onKey: (key: PadKey) => void;
  fingerprintUnlock: () => void;
};

export function usePinVerify({ onSuccess, autoFingerprint = true }: { onSuccess: () => void; autoFingerprint?: boolean }): PinVerifyState {
  const { t } = useTranslation('lock');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | undefined>();
  const [tone, setTone] = useState<'muted' | 'danger'>('muted');
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [checking, setChecking] = useState(false);
  const [shakeSignal, setShake] = useState(0);
  const [fingerprint, setFingerprint] = useState(false);
  const done = useRef(false);
  const succeed = useRef(onSuccess);
  useEffect(() => {
    succeed.current = onSuccess;
  }, [onSuccess]);

  const labels = { prompt: t('fingerprint.prompt'), cancel: t('fingerprint.cancel'), usePin: t('fingerprint.usePin') };

  const tryFingerprint = async () => {
    const ok = await unlockWithFingerprint(labels);
    if (ok && !done.current) {
      done.current = true;
      playHaptic('success');
      succeed.current();
    }
  };

  // On open: restore a running pause, and offer the fingerprint once when the phone has one.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const a = await readAttempts();
      if (!alive) return;
      if (lockoutRemaining(a, Date.now()) > 0) setLockedUntil(a.lockedUntil);
      const fp = await canUseFingerprint();
      if (!alive) return;
      setFingerprint(fp);
      if (fp && autoFingerprint) void tryFingerprint();
    })();
    return () => {
      alive = false;
    };
    // Runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown tick while paused.
  useEffect(() => {
    if (lockedUntil === null) return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockedUntil) {
        setLockedUntil(null);
        setMessage(t('verify.tryAgainNow'));
        setTone('muted');
      }
    }, 500);
    return () => clearInterval(id);
  }, [lockedUntil, t]);

  const remaining = lockedUntil === null ? 0 : Math.max(0, lockedUntil - now);
  const paused = remaining > 0;

  const check = async (pin: string) => {
    setChecking(true);
    const r = await verifyPin(pin);
    setChecking(false);
    setValue('');
    if (r.status === 'ok' || r.status === 'no_pin') {
      // no_pin: the flag says "PIN set" but this phone holds none; never lock the seller out.
      if (!done.current) {
        done.current = true;
        playHaptic('success');
        succeed.current();
      }
      return;
    }
    playHaptic('error');
    setShake((n) => n + 1);
    setTone('danger');
    if (r.status === 'locked') {
      setNow(Date.now());
      setLockedUntil(Date.now() + r.remainingMs);
      setMessage(undefined);
    } else {
      setMessage(t('verify.wrong', { count: triesLeft(r.attempts) }));
    }
  };

  const onKey = (key: PadKey) => {
    if (paused || checking) return;
    const next = pressKey(value, key);
    setValue(next);
    if (key !== 'back' && message && tone === 'danger') {
      setMessage(undefined);
      setTone('muted');
    }
    if (next.length === PIN_LENGTH && value.length < PIN_LENGTH) void check(next);
  };

  return {
    value,
    message: paused
      ? remaining > 90_000
        ? t('verify.pausedMinutes', { count: minutesLeft(remaining) })
        : t('verify.paused', { seconds: secondsLeft(remaining) })
      : message,
    messageTone: paused ? 'danger' : tone,
    disabled: paused || checking,
    shakeSignal,
    fingerprint,
    onKey,
    fingerprintUnlock: () => void tryFingerprint(),
  };
}
