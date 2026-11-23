import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { AppText, Button, Icon, PhoneInput, playHaptic, useToast } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { OnboardingScaffold } from './OnboardingScaffold';
import { readOnboardingDraft, saveOwnerWhatsapp } from './onboardingData';
import { ownerNumberToSave } from './onboardingLogic';
import { useOnboarded } from './useOnboarded';

/**
 * Step 3: where owner reports go. Pre-filled from the build (app.json extra.ownerWhatsApp via
 * the seed), so most sellers just tap Continue. Editable here; later only behind the PIN: once
 * setup has finished this step hands over to /settings/owner (PIN-gated) and never saves itself.
 */
export function OwnerScreen() {
  const onboarded = useOnboarded();
  const [afterSetup] = useState(onboarded);
  const router = useRouter();
  useEffect(() => {
    if (afterSetup) router.replace('/settings/owner');
  }, [afterSetup, router]);
  if (afterSetup) return null;
  return <OwnerStep />;
}

function OwnerStep() {
  const { t } = useTranslation('onboarding');
  const { t: tc } = useTranslation('common');
  const { space } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [initial] = useState(() => readOnboardingDraft(db).ownerWhatsapp);
  const [value, setValue] = useState<{ e164: string | null; text: string }>({ e164: initial || null, text: initial });
  const [error, setError] = useState(false);

  const next = () => {
    const toSave = ownerNumberToSave(value.text, value.e164);
    if (toSave === null) {
      setError(true);
      playHaptic('error');
      return;
    }
    try {
      saveOwnerWhatsapp(db, toSave);
      router.push('/app-lock');
    } catch {
      toast.show({ message: tc('errors.generic'), tone: 'danger' });
    }
  };

  const empty = value.text.trim() === '';

  return (
    <OnboardingScaffold
      testID="onboarding-owner"
      step="/owner"
      title={t('owner.title')}
      body={initial ? t('owner.bodyPrefilled') : t('owner.body')}
      footer={<Button testID="owner-continue" label={t('continue')} size="lg" fullWidth onPress={next} />}>
      <PhoneInput
        testID="owner-phone"
        label={t('owner.label')}
        helper={t('owner.helper')}
        value={value.e164 ?? ''}
        error={error ? t('owner.invalid') : undefined}
        onChange={(e164, text) => {
          setValue({ e164, text });
          if (error && ownerNumberToSave(text, e164) !== null) setError(false);
        }}
        onSubmitEditing={next}
      />
      {empty ? (
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
          <Icon name="info-outline" size={20} tone="textMuted" />
          <AppText variant="small" muted style={{ flex: 1 }}>
            {t('owner.later')}
          </AppText>
        </View>
      ) : null}
    </OnboardingScaffold>
  );
}
