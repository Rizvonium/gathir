/** /settings/storage — how much Gathir keeps on the phone, free space, and clearing shared files. */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatBytes } from '@/lib/storage';
import { AppText, Button, Card, EmptyState, Icon, ListRow, Skeleton } from '@/ui/components';
import type { ColorTokens } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

import { useStorage } from '../hooks/useStorage';
import { storageShares } from '../settingsLogic';
import { RowIcon } from './RowIcon';
import { SettingsGroup } from './SettingsGroup';
import { SubScreen } from './SubScreen';

const PART_TONES: Record<'photos' | 'data' | 'exports', keyof ColorTokens> = { photos: 'primary', data: 'teal', exports: 'saffron' };

export function StorageScreen() {
  const { t } = useTranslation('settings');
  const { colors, space, radius } = useTheme();
  const { view, retry, clearExports } = useStorage();

  if (view.status === 'loading') {
    return (
      <SubScreen testID="settings-storage" title={t('storage.title')} subtitle={t('storage.subtitle')}>
        <AppText muted accessibilityLiveRegion="polite">
          {t('storage.loading')}
        </AppText>
        <Skeleton height={120} rounded="card" />
        <Skeleton height={180} rounded="card" />
      </SubScreen>
    );
  }
  if (view.status === 'error') {
    return (
      <SubScreen testID="settings-storage" title={t('storage.title')}>
        <EmptyState
          illustration={<Icon name="error-outline" size={48} tone="danger" />}
          title={t('storage.error')}
          actionLabel={t('common:actions.retry')}
          actionIcon="refresh"
          onAction={retry}
        />
      </SubScreen>
    );
  }

  const u = view.usage;
  const parts = { photos: u.photosBytes, data: u.dbBytes, exports: u.exportsBytes };
  const shares = storageShares(parts);

  return (
    <SubScreen testID="settings-storage" title={t('storage.title')} subtitle={t('storage.subtitle')}>
      <Card padding="lg">
        <View style={{ gap: space.md }}>
          <AppText variant="heading" testID="storage-total">
            {t('storage.total', { size: formatBytes(view.totalBytes) })}
          </AppText>
          <View
            style={[styles.bar, { backgroundColor: colors.surfaceSunken, borderRadius: radius.pill }]}
            importantForAccessibility="no-hide-descendants">
            {(Object.keys(parts) as (keyof typeof parts)[]).map((k) =>
              shares[k] > 0 ? <View key={k} style={{ flex: shares[k], backgroundColor: colors[PART_TONES[k]] }} /> : null,
            )}
          </View>
          {view.freeBytes !== null ? (
            <AppText muted testID="storage-free">
              {t('storage.free', { size: formatBytes(view.freeBytes) })}
            </AppText>
          ) : null}
        </View>
      </Card>

      {view.low ? (
        <Card padding="lg" testID="storage-low">
          <View style={[styles.row, { gap: space.md }]}>
            <Icon name="warning-amber" size={28} tone="danger" />
            <View style={styles.flex}>
              <AppText weight="semibold">{t('storage.low')}</AppText>
              <AppText variant="small" muted>
                {t('storage.lowAction')}
              </AppText>
            </View>
          </View>
        </Card>
      ) : null}

      <SettingsGroup>
        <ListRow
          leading={<RowIcon name="photo-library" tone={PART_TONES.photos} />}
          title={t('storage.photos')}
          subtitle={t('storage.photosDetail', { count: u.photoCount })}
          trailing={<Size bytes={u.photosBytes} />}
        />
        <ListRow
          leading={<RowIcon name="storage" tone={PART_TONES.data} />}
          title={t('storage.data')}
          subtitle={t('storage.dataDetail')}
          trailing={<Size bytes={u.dbBytes} />}
        />
        <ListRow
          leading={<RowIcon name="picture-as-pdf" tone={PART_TONES.exports} />}
          title={t('storage.exports')}
          subtitle={t('storage.exportsDetail')}
          trailing={<Size bytes={u.exportsBytes} />}
        />
      </SettingsGroup>

      <Button
        testID="storage-clear"
        label={t('storage.clearExports')}
        icon="cleaning-services"
        variant="secondary"
        fullWidth
        disabled={u.exportsBytes === 0}
        onPress={clearExports}
      />
      <AppText variant="small" muted>
        {t('storage.deletedHint')}
      </AppText>
    </SubScreen>
  );
}

function Size({ bytes }: { bytes: number }) {
  return (
    <AppText weight="semibold" numeric>
      {formatBytes(bytes)}
    </AppText>
  );
}

const styles = StyleSheet.create({
  bar: { height: 12, flexDirection: 'row', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
