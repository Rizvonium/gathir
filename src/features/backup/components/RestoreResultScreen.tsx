/** /backup/result — what happened after a restore: success (open the shop) or why it failed (nothing changed). */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Icon, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import type { RestoreOutcome } from '../backupView';

const FAIL_TITLES = { invalid: 'result.invalidTitle', newer_version: 'result.newerTitle', failed: 'result.failedTitle' } as const;

export function RestoreResultScreen({ outcome }: { outcome: RestoreOutcome }) {
  const { t } = useTranslation('backup');
  const { space } = useTheme();
  const ok = outcome.kind === 'ok';

  const footer = ok ? (
    <Button testID="restore-open-shop" label={t('result.open')} icon="storefront" size="lg" fullWidth onPress={() => router.replace('/')} />
  ) : (
    <View style={{ gap: space.sm }}>
      <Button testID="restore-try-again" label={t('result.tryAgain')} icon="folder-open" size="lg" fullWidth onPress={() => router.replace('/backup')} />
      <Button label={t('result.back')} variant="ghost" fullWidth onPress={() => (router.canGoBack() ? router.back() : router.replace('/backup'))} />
    </View>
  );

  return (
    <Screen testID="restore-result" edges={['top', 'bottom']} footer={footer}>
      <View style={[styles.center, { gap: space.md }]} accessible accessibilityLiveRegion="polite">
        <Icon name={ok ? 'check-circle' : 'error-outline'} size={72} tone={ok ? 'meadow' : 'danger'} />
        <AppText variant="display" align="center" accessibilityRole="header" testID="restore-result-title">
          {ok ? t('result.okTitle') : t(FAIL_TITLES[outcome.kind])}
        </AppText>
        {outcome.kind === 'ok' ? (
          <>
            <AppText align="center">{t('result.okBody', outcome.counts)}</AppText>
            <AppText muted align="center">
              {t('result.okPin')}
            </AppText>
          </>
        ) : (
          <>
            <AppText align="center">{t(`errors.${outcome.kind}`)}</AppText>
            {outcome.kind !== 'failed' ? (
              <AppText muted align="center" weight="semibold">
                {t('result.safe')}
              </AppText>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
