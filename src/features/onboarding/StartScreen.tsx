import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { AppText, Icon, playHaptic, PressableScale, useToast, type IconName } from '@/ui/components';
import { touchTarget } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

import { OnboardingScaffold } from './OnboardingScaffold';
import { finishOnboarding } from './onboardingData';
import { useOnboarded } from './useOnboarded';

type Choice = 'add' | 'sample';

/**
 * Step 5: start for real ("Add your first shawl") or look around with sample products.
 * Either choice finishes onboarding and lands on Home; "add" then opens the add form.
 */
export function StartScreen() {
  const { t } = useTranslation('onboarding');
  const router = useRouter();
  const toast = useToast();
  const onboarded = useOnboarded();
  const leaving = useRef(false);
  const [busy, setBusy] = useState<Choice | null>(null);

  // A restored backup (from "Restore a backup") arrives already onboarded: go straight Home.
  useEffect(() => {
    if (onboarded && !leaving.current) {
      leaving.current = true;
      router.replace('/');
    }
  }, [onboarded, router]);

  const choose = (choice: Choice) => {
    if (busy) return;
    setBusy(choice);
    // Let the spinner paint before the synchronous sample insert.
    requestAnimationFrame(() => {
      try {
        leaving.current = true;
        finishOnboarding(db, { sample: choice === 'sample' });
        playHaptic('success');
        router.replace('/');
        if (choice === 'add') router.push('/product/new');
      } catch {
        leaving.current = false;
        setBusy(null);
        playHaptic('error');
        toast.show({ message: t('start.error'), tone: 'danger' });
      }
    });
  };

  return (
    <OnboardingScaffold
      testID="onboarding-start"
      step="/start"
      title={t('start.title')}
      body={t('start.body')}
      footer={
        <Pressable
          testID="start-restore"
          accessibilityRole="link"
          onPress={() => router.push('/backup')}
          style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
          <AppText variant="small" weight="bold" tone="teal" align="center">
            {t('start.restore')}
          </AppText>
        </Pressable>
      }>
      <ChoiceCard
        testID="start-add"
        icon="add-a-photo"
        title={t('start.addFirst')}
        hint={t('start.addFirstHint')}
        primary
        busy={busy === 'add'}
        disabled={busy !== null}
        onPress={() => choose('add')}
      />
      <ChoiceCard
        testID="start-sample"
        icon="auto-awesome"
        title={t('start.sample')}
        hint={t('start.sampleHint')}
        busy={busy === 'sample'}
        disabled={busy !== null}
        onPress={() => choose('sample')}
      />
    </OnboardingScaffold>
  );
}

function ChoiceCard({
  icon,
  title,
  hint,
  primary = false,
  busy,
  disabled,
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  hint: string;
  primary?: boolean;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { colors, space, radius } = useTheme();
  const fg = primary ? colors.onPrimary : colors.text;
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={`${title}. ${hint}`}
      accessibilityState={{ busy, disabled }}
      style={[
        styles.choice,
        {
          backgroundColor: primary ? colors.primary : colors.surface,
          borderColor: primary ? colors.primary : colors.border,
          borderRadius: radius.card,
          padding: space.lg,
          gap: space.lg,
        },
      ]}>
      <View style={[styles.iconWell, { backgroundColor: primary ? colors.onPrimary : colors.surfaceSunken, borderRadius: radius.md }]}>
        {busy ? <ActivityIndicator color={colors.primary} /> : <Icon name={icon} size={28} tone="primary" />}
      </View>
      <View style={styles.choiceText}>
        <AppText variant="title" color={fg}>
          {title}
        </AppText>
        <AppText variant="small" color={fg} style={{ opacity: primary ? 0.92 : 1 }}>
          {hint}
        </AppText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  choice: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, minHeight: 96 },
  iconWell: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  choiceText: { flex: 1, minWidth: 0, gap: 2 },
  link: { minHeight: touchTarget, justifyContent: 'center' },
});
