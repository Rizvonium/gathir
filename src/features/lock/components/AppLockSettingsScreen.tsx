/**
 * /settings/lock — turn the app lock on, change the PIN, or remove it. Removing asks for the
 * current PIN in place (that is the confirmation; no extra dialog).
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SubScreen } from '@/features/settings/components/SubScreen';
import { AppText, Button, Card, Icon } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { useAppLockSettings } from '../useAppLockSettings';
import { PinVerifyPanel } from './PinVerifyPanel';

export function AppLockSettingsScreen() {
  const { t } = useTranslation('settings');
  const { space } = useTheme();
  const s = useAppLockSettings();

  if (s.removing) {
    return (
      <SubScreen testID="settings-lock" title={t('lock.title')}>
        <PinVerifyPanel testID="lock-remove" title={t('lock.removeTitle')} subtitle={t('lock.removeSubtitle')} autoFingerprint={false} onSuccess={s.confirmRemove} />
        <Button label={t('lock.cancel')} variant="ghost" fullWidth onPress={s.cancelRemove} />
      </SubScreen>
    );
  }

  const footer = s.pinSet ? (
    <View style={{ gap: space.sm }}>
      <Button testID="lock-change" label={t('lock.change')} icon="password" size="lg" fullWidth onPress={() => router.push('/lock?mode=change')} />
      <Button testID="lock-remove-start" label={t('lock.remove')} icon="lock-open" variant="ghost" fullWidth onPress={s.startRemove} />
    </View>
  ) : (
    <Button testID="lock-set" label={t('lock.set')} icon="lock" size="lg" fullWidth onPress={() => router.push('/lock?mode=set')} />
  );

  return (
    <SubScreen testID="settings-lock" title={t('lock.title')} subtitle={t('lock.subtitle')} footer={footer}>
      <Card padding="lg">
        <View style={[styles.row, { gap: space.md }]} accessible>
          <Icon name={s.pinSet ? 'lock' : 'lock-open'} size={36} tone={s.pinSet ? 'meadow' : 'saffron'} />
          <View style={styles.flex}>
            <AppText variant="title" testID="lock-status">
              {s.pinSet ? t('lock.statusOn') : t('lock.statusOff')}
            </AppText>
            <AppText muted>{s.pinSet ? t('lock.statusOnBody') : t('lock.statusOffBody')}</AppText>
          </View>
        </View>
      </Card>
      <View style={[styles.row, { gap: space.sm, paddingHorizontal: space.xs }]}>
        <Icon name="fingerprint" size={24} tone={s.fingerprint ? 'primary' : 'textMuted'} />
        <AppText variant="small" muted style={styles.flex}>
          {s.fingerprint ? t('lock.fingerprintOn') : t('lock.fingerprintOff')}
        </AppText>
      </View>
      {s.pinSet ? (
        <View style={[styles.row, { gap: space.sm, paddingHorizontal: space.xs }]}>
          <Icon name="storefront" size={24} tone="textMuted" />
          <AppText variant="small" muted style={styles.flex}>
            {t('lock.showroomNote')}
          </AppText>
        </View>
      ) : null}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
