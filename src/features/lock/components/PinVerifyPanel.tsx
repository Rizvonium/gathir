/** "Enter your PIN" with fingerprint. Used by the app-lock gate, /lock and PIN-protected settings. */
import { useTranslation } from 'react-i18next';

import { usePinVerify } from '../usePinVerify';
import { PinPad } from './PinPad';

export type PinVerifyPanelProps = {
  onSuccess: () => void;
  title?: string;
  subtitle?: string;
  /** Show the system fingerprint prompt as soon as the panel opens (default true). */
  autoFingerprint?: boolean;
  testID?: string;
};

export function PinVerifyPanel({ onSuccess, title, subtitle, autoFingerprint = true, testID = 'pin-verify' }: PinVerifyPanelProps) {
  const { t } = useTranslation('lock');
  const s = usePinVerify({ onSuccess, autoFingerprint });
  return (
    <PinPad
      testID={testID}
      title={title ?? t('verify.title')}
      subtitle={subtitle ?? (s.fingerprint ? t('verify.subtitleFingerprint') : t('verify.subtitle'))}
      value={s.value}
      onKey={s.onKey}
      message={s.message}
      messageTone={s.messageTone}
      disabled={s.disabled}
      shakeSignal={s.shakeSignal}
      extraKey={s.fingerprint ? { icon: 'fingerprint', label: t('fingerprint.use'), onPress: s.fingerprintUnlock } : undefined}
    />
  );
}
