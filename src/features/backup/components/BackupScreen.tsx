/**
 * /backup — one big "Make a backup" (the frequent, safe action) at the thumb; restore lives
 * lower down and always passes a warning sheet first (it replaces everything, no Undo).
 */
import { Paths } from 'expo-file-system';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useToday } from '@/db/hooks';
import { SubScreen } from '@/features/settings/components/SubScreen';
import { backupAge, backupIsStale } from '@/features/settings/settingsLogic';
import { formatDate, formatTime } from '@/lib/dates';
import { formatBytes } from '@/lib/storage';
import { AppSheet, AppText, Button, Card, Icon, SectionHeader, Skeleton } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { estimateBackupBytes } from '../backupView';
import { useBackup } from '../hooks/useBackup';

function freeSpace(): number | null {
  try {
    return Paths.availableDiskSpace;
  } catch {
    return null;
  }
}

export function BackupScreen() {
  const { t } = useTranslation('backup');
  const { space } = useTheme();
  const b = useBackup();
  const now = useToday();
  const age = backupAge(b.lastBackupAt, now);
  const stale = backupIsStale(b.lastBackupAt, now);
  const free = b.usage ? freeSpace() : null;

  const headline =
    age.kind === 'never'
      ? t('status.never')
      : age.kind === 'today'
        ? t('status.today', { time: formatTime(b.lastBackupAt ?? now) })
        : t('status.days', { count: age.days });
  const detail = age.kind === 'never' ? t('status.neverBody') : stale ? t('status.stale') : t('status.fresh');
  const createLabel = b.phase === 'creating' ? t('create.making') : b.phase === 'sharing' ? t('create.opening') : t('create.button');

  if (b.phase === 'restoring') {
    return (
      <SubScreen testID="backup-screen" title={t('screen.title')} scroll={false}>
        <View style={[styles.center, { gap: space.md }]} accessible accessibilityLiveRegion="assertive">
          <Icon name="settings-backup-restore" size={56} tone="primary" />
          <AppText variant="heading" align="center">
            {t('restore.restoring')}
          </AppText>
          <AppText muted align="center">
            {t('restore.restoringBody')}
          </AppText>
        </View>
      </SubScreen>
    );
  }

  return (
    <SubScreen
      testID="backup-screen"
      title={t('screen.title')}
      subtitle={t('screen.subtitle')}
      footer={
        <View style={{ gap: space.xs }}>
          <Button testID="backup-create" label={createLabel} icon="backup" size="lg" fullWidth loading={b.busy} disabled={b.busy} onPress={b.create} />
          {b.usage ? (
            <AppText variant="small" muted align="center">
              {t('create.size', { size: formatBytes(estimateBackupBytes(b.usage)) })}
            </AppText>
          ) : null}
        </View>
      }>
      <Card padding="lg" testID="backup-status">
        <View style={[styles.row, { gap: space.md }]} accessible>
          <Icon name={stale ? 'warning-amber' : 'verified-user'} size={36} tone={stale ? 'saffron' : 'meadow'} />
          <View style={styles.flex}>
            <AppText variant="title">{headline}</AppText>
            {b.lastBackupAt !== null && age.kind !== 'today' ? (
              <AppText variant="small" muted>
                {t('status.date', { date: formatDate(b.lastBackupAt), time: formatTime(b.lastBackupAt) })}
              </AppText>
            ) : null}
            <AppText muted>{detail}</AppText>
          </View>
        </View>
      </Card>

      <AppText muted>{t('create.where')}</AppText>

      <View style={{ gap: space.sm }}>
        <SectionHeader title={t('contains.title')} />
        <Card padding="lg">
          <View style={{ gap: space.md }}>
            <AppText>{t('contains.body')}</AppText>
            <View style={[styles.row, { gap: space.sm }]}>
              <Icon name="privacy-tip" size={20} tone="rose" />
              <AppText variant="small" muted style={styles.flex}>
                {t('contains.privacy')}
              </AppText>
            </View>
          </View>
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <SectionHeader title={t('storage.title')} />
        <Card padding="lg">
          {b.usage ? (
            <View style={{ gap: space.xs }} testID="backup-storage">
              <AppText>{t('storage.photos', { count: b.usage.photoCount, size: formatBytes(b.usage.photosBytes) })}</AppText>
              <AppText>{t('storage.data', { size: formatBytes(b.usage.dbBytes) })}</AppText>
              {free !== null ? <AppText muted>{t('storage.free', { size: formatBytes(free) })}</AppText> : null}
            </View>
          ) : (
            <Skeleton height={64} rounded="md" />
          )}
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <SectionHeader title={t('restore.title')} />
        <AppText muted>{t('restore.body')}</AppText>
        <Button testID="backup-restore" label={t('restore.button')} icon="settings-backup-restore" variant="secondary" fullWidth disabled={b.busy} onPress={b.openWarning} />
      </View>

      <AppSheet visible={b.warning} onClose={b.closeWarning} title={t('restore.sheetTitle')} testID="restore-warning">
        <View style={{ gap: space.md }}>
          <View style={[styles.row, { gap: space.md }]}>
            <Icon name="report" size={32} tone="danger" />
            <AppText style={styles.flex}>{t('restore.sheetBody')}</AppText>
          </View>
          <AppText muted>{t('restore.sheetTip')}</AppText>
          <Button testID="restore-backup-first" label={t('restore.backupFirst')} icon="backup" variant="tonal" fullWidth onPress={b.backupFirst} />
          <Button testID="restore-confirm" label={t('restore.confirm')} icon="settings-backup-restore" variant="danger" fullWidth onPress={b.restore} />
          <Button testID="restore-keep" label={t('restore.keep')} variant="ghost" fullWidth onPress={b.closeWarning} />
        </View>
      </AppSheet>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
