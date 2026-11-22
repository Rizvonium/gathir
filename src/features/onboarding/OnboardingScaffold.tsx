import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { I18nManager, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, IconButton, ProgressDots, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { ONBOARDING_STEPS, stepIndex, type OnboardingStep } from './onboardingLogic';

export type OnboardingScaffoldProps = {
  step: OnboardingStep;
  title: string;
  body?: string;
  children?: ReactNode;
  /** Sticky thumb-zone actions; ride above the keyboard. */
  footer?: ReactNode;
  testID?: string;
};

/**
 * Shared frame for every first-launch step: back button and step dots on top, a large
 * Fraunces question, a plain-language line, the step content and a sticky footer.
 */
export function OnboardingScaffold({ step, title, body, children, footer, testID }: OnboardingScaffoldProps) {
  const { t } = useTranslation('onboarding');
  const { space } = useTheme();
  const router = useRouter();
  return (
    <Screen
      testID={testID}
      scroll
      edges={['top', 'bottom']}
      leading={
        <IconButton
          icon="arrow-back"
          accessibilityLabel={t('back')}
          onPress={() => router.back()}
          style={I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
        />
      }
      actions={<ProgressDots total={ONBOARDING_STEPS.length} current={stepIndex(step)} style={{ marginEnd: space.md }} />}
      footer={footer}>
      <View style={{ gap: space.sm, marginBottom: space.xs }}>
        <AppText variant="display" accessibilityRole="header">
          {title}
        </AppText>
        {body ? <AppText muted>{body}</AppText> : null}
      </View>
      {children}
    </Screen>
  );
}
