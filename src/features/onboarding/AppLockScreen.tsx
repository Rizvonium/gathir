import { useRouter, type Href } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDbQuery } from '@/db/hooks';
import { AppText, Button, Card, Icon } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { OnboardingScaffold } from './OnboardingScaffold';
import { readOnboardingDraft } from './onboardingData';

/** Where the lock screen sends the seller after a PIN is set. */
export const SET_PIN_HREF = `/lock?mode=set&returnTo=${encodeURIComponent('/start')}`;

/** Step 4 (optional): PIN / fingerprint. Owned by the lock feature; this step only links to it. */
export function AppLockScreen() {
  const { t } = useTranslation('onboarding');
  const { space } = useTheme();
  const router = useRouter();
  const pinSet = useDbQuery((d) => readOnboardingDraft(d).pinSet, [], { tables: ['shop_settings'] });

  return (
    <OnboardingScaffold
      testID="onboarding-lock"
      step="/app-lock"
      title={t('lock.title')}
      body={t('lock.body')}
      footer={
        pinSet ? (
          <Button testID="lock-continue" label={t('continue')} size="lg" fullWidth onPress={() => router.push('/start')} />
        ) : (
          <>
            <Button testID="lock-set" label={t('lock.setPin')} icon="lock" size="lg" fullWidth onPress={() => router.push(SET_PIN_HREF as Href)} />
            <Button testID="lock-skip" label={t('lock.skip')} variant="ghost" fullWidth onPress={() => router.push('/start')} />
          </>
        )
      }>
      <Card padding="xl">
        <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
          <Icon name={pinSet ? 'check-circle' : 'fingerprint'} size={48} tone={pinSet ? 'meadow' : 'primary'} />
          <AppText style={{ flex: 1 }} accessibilityLiveRegion="polite">
            {pinSet ? t('lock.done') : t('lock.later')}
          </AppText>
        </View>
      </Card>
    </OnboardingScaffold>
  );
}
