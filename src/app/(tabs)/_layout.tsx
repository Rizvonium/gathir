import { NativeTabs } from 'expo-router/native-tabs';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/ui/theme';

/** Five peer tabs. Tab switches never animate (expo-animation skill). */
export default function TabsLayout() {
  const { colors, fonts } = useTheme();
  const { t } = useTranslation();
  return (
    <NativeTabs
      backgroundColor={colors.surface}
      indicatorColor={colors.surfaceSunken}
      labelStyle={{ default: { color: colors.textMuted, fontFamily: fonts.bodySemi }, selected: { color: colors.primary, fontFamily: fonts.bodyBold } }}
      iconColor={{ default: colors.textMuted, selected: colors.primary }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabs.home')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="storefront" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stock">
        <NativeTabs.Trigger.Label>{t('tabs.stock')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="inventory_2" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sales">
        <NativeTabs.Trigger.Label>{t('tabs.sales')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="receipt_long" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="customers">
        <NativeTabs.Trigger.Label>{t('tabs.customers')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="groups" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>{t('tabs.more')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="more_horiz" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
