/** Set a new PIN: type it, type it again, save the hash and the settings flag. */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { updateSettings } from '@/db/repo/settings';
import { playHaptic } from '@/ui/components';

import { PIN_LENGTH, pressKey, type PadKey } from './pinLogic';
import { savePin } from './pinStore';

export type SetPinState = {
  step: 'enter' | 'confirm';
  value: string;
  message: string | undefined;
  messageTone: 'muted' | 'danger';
  shakeSignal: number;
  saving: boolean;
  onKey: (key: PadKey) => void;
  startOver: () => void;
};

export function useSetPin({ onDone }: { onDone: () => void }): SetPinState {
  const { t } = useTranslation('lock');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [first, setFirst] = useState('');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | undefined>();
  const [tone, setTone] = useState<'muted' | 'danger'>('muted');
  const [shakeSignal, setShake] = useState(0);
  const [saving, setSaving] = useState(false);

  const startOver = () => {
    setStep('enter');
    setFirst('');
    setValue('');
    setMessage(undefined);
    setTone('muted');
  };

  const finish = async (pin: string) => {
    setSaving(true);
    try {
      await savePin(pin);
      updateSettings(db, { pinHashSet: true });
      playHaptic('success');
      onDone();
    } catch {
      playHaptic('error');
      setSaving(false);
      startOver();
      setTone('danger');
      setMessage(t('set.saveFailed'));
    }
  };

  const onKey = (key: PadKey) => {
    if (saving) return;
    const next = pressKey(value, key);
    setValue(next);
    if (key !== 'back' && tone === 'danger') {
      setTone('muted');
      setMessage(undefined);
    }
    if (next.length < PIN_LENGTH || value.length === PIN_LENGTH) return;
    if (step === 'enter') {
      setFirst(next);
      setValue('');
      setStep('confirm');
      setMessage(undefined);
      return;
    }
    if (next === first) {
      void finish(next);
    } else {
      playHaptic('error');
      setShake((n) => n + 1);
      setStep('enter');
      setFirst('');
      setValue('');
      setTone('danger');
      setMessage(t('set.mismatch'));
    }
  };

  return { step, value, message, messageTone: tone, shakeSignal, saving, onKey, startOver };
}
