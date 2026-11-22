/**
 * /settings/catalogue — default look of customer catalogues (the same remembered options the
 * Send catalogue flow uses) and whether Showroom shows exact counts. Every change saves at once.
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useSettings } from '@/db/hooks';
import { updateSettings } from '@/db/repo/settings';
import { parseStoredForm, storedFormJson, type CatalogueForm } from '@/features/catalogue/logic/options';
import { Card, ChipGroup, SectionHeader, useToast } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { SubScreen } from './SubScreen';
import { ToggleRow } from './ToggleRow';

export function CatalogueSettingsScreen() {
  const { t } = useTranslation('settings');
  const { space } = useTheme();
  const toast = useToast();
  const settings = useSettings();
  const form = parseStoredForm(settings?.catalogueOptionsJson, settings?.catalogueStyle ?? 'bazaar');

  const save = (patch: Partial<CatalogueForm>) => {
    const next = { ...form, ...patch };
    try {
      updateSettings(db, { catalogueOptionsJson: storedFormJson(next), catalogueStyle: next.style });
    } catch {
      toast.show({ message: t('saveFailed'), tone: 'danger' });
    }
  };

  return (
    <SubScreen testID="settings-catalogue" title={t('catalogue.title')} subtitle={t('catalogue.subtitle')}>
      <View style={{ gap: space.sm }}>
        <SectionHeader title={t('catalogue.styleTitle')} />
        <ChipGroup
          testID="catalogue-style"
          mode="single"
          accessibilityLabel={t('catalogue.styleTitle')}
          value={form.style}
          onChange={(style) => save({ style })}
          options={[
            { value: 'bazaar', label: `${t('catalogue.bazaar')}: ${t('catalogue.bazaarHint')}`, icon: 'palette' },
            { value: 'ivory', label: `${t('catalogue.ivory')}: ${t('catalogue.ivoryHint')}`, icon: 'auto-awesome' },
          ]}
        />
      </View>
      <View style={{ gap: space.sm }}>
        <SectionHeader title={t('catalogue.columnsTitle')} />
        <ChipGroup
          testID="catalogue-columns"
          mode="single"
          accessibilityLabel={t('catalogue.columnsTitle')}
          value={form.columns}
          onChange={(columns) => save({ columns })}
          options={[
            { value: 2 as const, label: t('catalogue.columns2'), icon: 'grid-view' },
            { value: 3 as const, label: t('catalogue.columns3'), icon: 'apps' },
          ]}
        />
      </View>
      <Card padding="md">
        <ToggleRow testID="catalogue-rates" label={t('catalogue.showRates')} helper={t('catalogue.showRatesHelp')} value={form.showRates} onChange={(showRates) => save({ showRates })} />
        <ToggleRow
          testID="catalogue-only-left"
          label={t('catalogue.showOnlyLeft')}
          helper={t('catalogue.showOnlyLeftHelp')}
          value={form.showOnlyLeft}
          onChange={(showOnlyLeft) => save({ showOnlyLeft })}
        />
        <ToggleRow testID="catalogue-hide-sold" label={t('catalogue.hideSoldOut')} value={form.hideSoldOut} onChange={(hideSoldOut) => save({ hideSoldOut })} />
      </Card>
      <View style={{ gap: space.sm }}>
        <SectionHeader title={t('catalogue.showroomTitle')} />
        <Card padding="md">
          <ToggleRow
            testID="showroom-counts"
            label={t('catalogue.showroomCounts')}
            helper={t('catalogue.showroomCountsHelp')}
            value={settings?.showroomShowsExactCounts ?? false}
            onChange={(on) => {
              try {
                updateSettings(db, { showroomShowsExactCounts: on });
              } catch {
                toast.show({ message: t('saveFailed'), tone: 'danger' });
              }
            }}
          />
        </Card>
      </View>
    </SubScreen>
  );
}
