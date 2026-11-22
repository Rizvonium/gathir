/** /settings/sample-data — add example shawls to learn the app, or clear them before real selling. */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card, Icon } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { useSampleData } from '../hooks/useSampleData';
import { SubScreen } from './SubScreen';

export function SampleDataScreen() {
  const { t } = useTranslation('settings');
  const { space } = useTheme();
  const s = useSampleData();
  return (
    <SubScreen
      testID="settings-sample"
      title={t('sample.title')}
      subtitle={t('sample.subtitle')}
      footer={
        s.present ? (
          <Button testID="sample-clear" label={t('sample.clear')} icon="delete-sweep" variant="danger" size="lg" fullWidth loading={s.busy} onPress={s.clear} />
        ) : (
          <Button testID="sample-add" label={t('sample.add')} icon="science" size="lg" fullWidth loading={s.busy} onPress={s.add} />
        )
      }>
      <Card padding="lg">
        <View style={[styles.row, { gap: space.md }]} accessible accessibilityLiveRegion="polite">
          <Icon name={s.present ? 'science' : 'inventory-2'} size={32} tone={s.present ? 'saffron' : 'textMuted'} />
          <View style={styles.flex}>
            <AppText variant="title">{s.present ? t('sample.isOn') : t('sample.isOff')}</AppText>
            <AppText muted>{s.present ? t('sample.isOnBody') : t('sample.isOffBody')}</AppText>
          </View>
        </View>
      </Card>
      <View style={[styles.row, { gap: space.sm, paddingHorizontal: space.xs }]}>
        <Icon name="verified-user" size={20} tone="meadow" />
        <AppText variant="small" muted style={styles.flex}>
          {t('sample.safe')}
        </AppText>
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
