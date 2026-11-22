import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { AppText, Button, Icon, PressableScale, useToast } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { OnboardingScaffold } from './OnboardingScaffold';
import { saveLanguage } from './onboardingData';

/** Languages shown on first launch. Urdu and Hindi arrive in 1.1; their cards are built now. */
export const LANGUAGES = [
  { code: 'en', native: 'English', english: 'English', available: true },
  { code: 'ur', native: 'اردو', english: 'Urdu', available: false },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', available: false },
] as const;

/** Step 1: language. English is selected; the others say "Coming soon". */
export function LanguageScreen() {
  const { t } = useTranslation('onboarding');
  const { t: tc } = useTranslation('common');
  const { colors, space, radius } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const selected = 'en';

  const next = () => {
    try {
      saveLanguage(db, selected);
      router.push('/shop');
    } catch {
      toast.show({ message: tc('errors.generic'), tone: 'danger' });
    }
  };

  return (
    <OnboardingScaffold
      testID="onboarding-language"
      step="/language"
      title={t('language.title')}
      body={t('language.body')}
      footer={<Button testID="language-continue" label={t('continue')} size="lg" fullWidth onPress={next} />}>
      <View accessibilityRole="radiogroup" style={{ gap: space.md }}>
        {LANGUAGES.map((lang) => {
          const isSelected = lang.code === selected;
          return (
            <PressableScale
              key={lang.code}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled: !lang.available }}
              accessibilityLabel={
                lang.available ? t('language.a11ySelected', { name: lang.english }) : t('language.a11yComingSoon', { name: lang.english })
              }
              disabled={!lang.available}
              haptic="selection"
              style={[
                styles.card,
                {
                  borderRadius: radius.card,
                  padding: space.lg,
                  gap: space.md,
                  backgroundColor: isSelected ? colors.surface : colors.surfaceSunken,
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}>
              <View style={styles.text}>
                <AppText variant="heading" style={!lang.available && { color: colors.textMuted }}>
                  {lang.native}
                </AppText>
                {lang.native !== lang.english ? (
                  <AppText variant="small" muted>
                    {lang.english}
                  </AppText>
                ) : null}
              </View>
              {isSelected ? (
                <View style={[styles.status, { gap: space.xs }]}>
                  <Icon name="check-circle" tone="primary" />
                  <AppText variant="small" weight="bold" tone="primary">
                    {t('language.selected')}
                  </AppText>
                </View>
              ) : (
                <View style={[styles.pill, { backgroundColor: colors.bg, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs }]}>
                  <AppText variant="caption" muted>
                    {t('language.comingSoon')}
                  </AppText>
                </View>
              )}
            </PressableScale>
          );
        })}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', minHeight: 80 },
  text: { flex: 1, minWidth: 0 },
  status: { flexDirection: 'row', alignItems: 'center' },
  pill: { borderWidth: 1 },
});
