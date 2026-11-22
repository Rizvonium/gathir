import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText, Button } from '@/ui/components';
import { timing } from '@/ui/motion';
import { KaniWeaveBackground, ThreadWeaveLogo } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

/**
 * First launch, step 0: the brand moment. Threads weave into the paisley mark (1.2 s, tap
 * to skip); then the promise and "Get started" fade in. Reduced motion: the mark fades in.
 */
export function WelcomeScreen() {
  const { t } = useTranslation('onboarding');
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [woven, setWoven] = useState(false);
  const reveal = useSharedValue(0);

  useEffect(() => {
    if (woven) reveal.set(withTiming(1, timing.standard));
  }, [woven, reveal]);
  const revealStyle = useAnimatedStyle(() => ({ opacity: reveal.get() }));

  return (
    <View testID="welcome" style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom + space.lg }]}>
      <KaniWeaveBackground />
      <View style={[styles.center, { gap: space.xl, paddingHorizontal: space.xl }]}>
        <ThreadWeaveLogo size={176} skipLabel={t('skipIntro')} onDone={() => setWoven(true)} />
        <View style={{ gap: space.sm }}>
          <AppText variant="display" align="center" accessibilityRole="header">
            {t('welcome.tagline')}
          </AppText>
          <Animated.View style={revealStyle}>
            <AppText muted align="center" style={styles.body}>
              {t('welcome.body')}
            </AppText>
          </Animated.View>
        </View>
      </View>
      <Animated.View style={[{ paddingHorizontal: space.lg }, revealStyle]} pointerEvents={woven ? 'auto' : 'none'}>
        <Button testID="welcome-start" label={t('welcome.start')} size="lg" fullWidth disabled={!woven} onPress={() => router.push('/language')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { maxWidth: 320, alignSelf: 'center' },
});
