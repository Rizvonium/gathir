/**
 * /settings/owner — where owner reports go. When a PIN is set, the PIN is asked first, so
 * nobody else holding the phone can redirect the reports (PLAN §3, §15).
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { updateSettings } from '@/db/repo/settings';
import { PinGate } from '@/features/lock/components/PinGate';
import { formatPhone } from '@/lib/phone';
import { AppText, Button, Card, Icon, PhoneInput, playHaptic, useToast } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { readSettingsRow } from '../settingsData';
import { ownerNumberToSave } from '../settingsLogic';
import { SubScreen, goBack } from './SubScreen';

export function OwnerSettingsScreen() {
  const { t } = useTranslation('settings');
  return (
    <SubScreen testID="settings-owner" title={t('owner.title')} subtitle={t('owner.subtitle')}>
      <PinGate title={t('owner.pinTitle')} subtitle={t('owner.pinSubtitle')}>
        <OwnerForm />
      </PinGate>
    </SubScreen>
  );
}

function OwnerForm() {
  const { t } = useTranslation('settings');
  const { space } = useTheme();
  const toast = useToast();
  const [initial] = useState(() => readSettingsRow(db)?.ownerWhatsapp ?? '');
  const [value, setValue] = useState<{ e164: string | null; text: string }>({ e164: initial || null, text: initial });
  const [error, setError] = useState(false);

  const save = () => {
    const toSave = ownerNumberToSave(value.text, value.e164);
    if (toSave === null) {
      setError(true);
      playHaptic('error');
      return;
    }
    try {
      updateSettings(db, { ownerWhatsapp: toSave });
      playHaptic('success');
      toast.show({ message: t('owner.saved'), tone: 'success' });
      goBack();
    } catch {
      toast.show({ message: t('saveFailed'), tone: 'danger' });
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      <Card padding="lg">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Icon name={initial ? 'chat' : 'warning-amber'} size={28} tone={initial ? 'meadow' : 'saffron'} />
          <AppText style={{ flex: 1 }}>{initial ? t('owner.current', { phone: formatPhone(initial) }) : t('owner.noneYet')}</AppText>
        </View>
      </Card>
      <PhoneInput
        testID="owner-phone"
        label={t('owner.label')}
        helper={t('owner.helper')}
        error={error ? t('owner.invalid') : undefined}
        value={value.e164 ?? ''}
        onChange={(e164, text) => {
          setValue({ e164, text });
          if (error) setError(false);
        }}
        onSubmitEditing={save}
      />
      <Button testID="owner-save" label={t('owner.save')} icon="check" size="lg" fullWidth onPress={save} />
    </View>
  );
}
