/**
 * More tab (PLAN §4.10): grouped rows, most-used first. Each row says its current value, so
 * the seller rarely needs to open a screen just to check something. Urgent states (no owner
 * number, no recent backup) are written out in words with a warning icon.
 */
import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatPhone } from '@/lib/phone';
import { AppText, Icon, ListRow, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { useMore } from '../hooks/useMore';
import { RowIcon } from './RowIcon';
import { SettingsGroup } from './SettingsGroup';
import { ToggleRow } from './ToggleRow';

const go = (href: Href) => () => router.push(href);

export function MoreScreen() {
  const { t } = useTranslation('settings');
  const { space } = useTheme();
  const m = useMore();
  const s = m.summary;

  const backupLine =
    m.backup.kind === 'never'
      ? t('more.backupNever')
      : m.backup.kind === 'today'
        ? t('more.backupToday')
        : t('more.backupDays', { count: m.backup.days });
  const warn = <Icon name="warning-amber" tone="saffron" accessibilityLabel={t('notSet')} />;

  return (
    <Screen testID="more-screen" title={t('more.title')} scroll>
      <SettingsGroup title={t('more.groups.shop')}>
        <ListRow
          testID="more-shop"
          leading={<RowIcon name="storefront" />}
          title={t('more.shop')}
          subtitle={s.shopName ? [s.shopName, s.sellerName].filter(Boolean).join(' · ') : t('more.shopEmpty')}
          onPress={go('/settings/shop')}
        />
        <ListRow
          testID="more-owner"
          leading={<RowIcon name="chat" tone="meadow" />}
          title={t('more.owner')}
          subtitle={s.ownerWhatsapp ? formatPhone(s.ownerWhatsapp) : t('more.ownerMissing')}
          trailing={s.ownerWhatsapp ? undefined : warn}
          onPress={go('/settings/owner')}
        />
        <ListRow
          testID="more-language"
          leading={<RowIcon name="translate" tone="indigo" />}
          title={t('more.language')}
          subtitle={t('language.english')}
          onPress={go('/settings/language')}
        />
      </SettingsGroup>

      <SettingsGroup title={t('more.groups.reports')}>
        <ListRow
          testID="more-send-report"
          leading={<RowIcon name="send" tone="primary" />}
          title={t('more.sendReport')}
          subtitle={t('more.sendReportHint')}
          onPress={go('/report')}
        />
        <ListRow
          testID="more-report-history"
          leading={<RowIcon name="history" tone="teal" />}
          title={t('more.reportHistory')}
          subtitle={s.sentReports > 0 ? t('more.reportHistoryCount', { count: s.sentReports }) : t('more.reportHistoryNone')}
          onPress={go('/report/history')}
        />
        <View style={{ paddingHorizontal: space.lg }}>
          <ToggleRow
            testID="more-report-phones"
            label={t('more.reportPhones')}
            helper={t('more.reportPhonesHelp')}
            value={s.includePhones}
            onChange={m.setIncludePhones}
          />
          <ToggleRow
            testID="more-report-profit"
            label={t('more.reportProfit')}
            helper={t('more.reportProfitHelp')}
            value={s.includeProfit}
            onChange={m.setIncludeProfit}
          />
        </View>
      </SettingsGroup>

      <SettingsGroup title={t('more.groups.stock')}>
        <ListRow
          testID="more-low-stock"
          leading={<RowIcon name="trending-down" tone="saffron" />}
          title={t('more.lowStock')}
          subtitle={m.lowStock.kind === 'off' ? t('more.lowStockOff') : t('more.lowStockAt', { count: m.lowStock.count })}
          onPress={go('/settings/stock')}
        />
        <ListRow
          testID="more-categories"
          leading={<RowIcon name="category" tone="teal" />}
          title={t('more.categories')}
          subtitle={t('more.categoriesCount', { count: s.categoryCount })}
          onPress={go('/settings/stock')}
        />
        <ListRow
          testID="more-catalogue"
          leading={<RowIcon name="auto-stories" tone="rose" />}
          title={t('more.catalogue')}
          subtitle={t(`more.catalogueStyle.${s.catalogueStyle}`)}
          onPress={go('/settings/catalogue')}
        />
        <ListRow
          testID="more-tags"
          leading={<RowIcon name="label" tone="indigo" />}
          title={t('more.tags')}
          subtitle={t('more.tagsHint')}
          onPress={go('/settings/tags')}
        />
      </SettingsGroup>

      <SettingsGroup title={t('more.groups.safety')}>
        <ListRow
          testID="more-lock"
          leading={<RowIcon name={s.pinSet ? 'lock' : 'lock-open'} tone={s.pinSet ? 'meadow' : 'textMuted'} />}
          title={t('more.lock')}
          subtitle={s.pinSet ? t('more.lockOn') : t('more.lockOff')}
          onPress={go('/settings/lock')}
        />
        <ListRow
          testID="more-backup"
          leading={<RowIcon name="cloud-upload" tone="teal" />}
          title={t('more.backup')}
          subtitle={backupLine}
          trailing={m.backupStale ? warn : undefined}
          onPress={go('/backup')}
        />
        <ListRow
          testID="more-deleted"
          leading={<RowIcon name="restore-from-trash" tone="rose" />}
          title={t('more.deleted')}
          subtitle={t('more.deletedHint')}
          onPress={go('/deleted')}
        />
      </SettingsGroup>

      <SettingsGroup title={t('more.groups.phone')}>
        <ListRow
          testID="more-storage"
          leading={<RowIcon name="sd-storage" tone="indigo" />}
          title={t('more.storage')}
          subtitle={t('more.storageHint')}
          onPress={go('/settings/storage')}
        />
        <ListRow
          testID="more-sample"
          leading={<RowIcon name="science" tone="saffron" />}
          title={t('more.sample')}
          subtitle={s.hasSample ? t('more.sampleOn') : t('more.sampleOff')}
          onPress={go('/settings/sample-data')}
        />
      </SettingsGroup>

      <View style={[styles.about, { gap: space.xs, paddingVertical: space.lg }]} accessible accessibilityLabel={`${t('more.version', { version: m.version })}. ${t('more.madeFor')}. ${t('more.offline')}`}>
        <AppText variant="title" align="center">
          {t('more.version', { version: m.version })}
        </AppText>
        <AppText align="center" tone="primary" weight="semibold">
          {t('more.madeFor')}
        </AppText>
        <AppText variant="small" muted align="center">
          {t('more.offline')}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  about: { alignItems: 'center' },
});
