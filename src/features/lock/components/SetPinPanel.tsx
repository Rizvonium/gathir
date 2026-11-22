/** Choose a new 4-digit PIN, then type it again. */
import { useTranslation } from 'react-i18next';

import { useSetPin } from '../useSetPin';
import { PinPad } from './PinPad';

export function SetPinPanel({ onDone, testID = 'pin-set' }: { onDone: () => void; testID?: string }) {
  const { t } = useTranslation('lock');
  const s = useSetPin({ onDone });
  return (
    <PinPad
      testID={testID}
      title={s.step === 'enter' ? t('set.title') : t('set.confirmTitle')}
      subtitle={s.step === 'enter' ? t('set.subtitle') : t('set.confirmSubtitle')}
      value={s.value}
      onKey={s.onKey}
      message={s.message}
      messageTone={s.messageTone}
      disabled={s.saving}
      shakeSignal={s.shakeSignal}
    />
  );
}
