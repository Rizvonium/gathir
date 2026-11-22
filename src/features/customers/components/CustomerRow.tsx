import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CustomerListRow } from '@/db/repo/customerQueries';
import { formatINR } from '@/lib/money';
import { AppText, Avatar, Icon, IconButton } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { avatarTint, relativePast } from '../logic/customerLogic';

export type CustomerRowProps = {
  row: CustomerListRow;
  now: number;
  onPress: (row: CustomerListRow) => void;
  onWhatsApp: (row: CustomerListRow) => void;
  onCall: (row: CustomerListRow) => void;
};

/**
 * One customer: tinted initials, name, type · city, last visit and lifetime spend, with quick
 * WhatsApp and Call buttons (48dp each). Long names truncate; the row grows with font size.
 */
export const CustomerRow = memo(function CustomerRow({ row, now, onPress, onWhatsApp, onCall }: CustomerRowProps) {
  const { colors, space } = useTheme();
  const { t } = useTranslation('customers');
  const accents = [colors.teal, colors.rose, colors.meadow, colors.indigo, colors.primary];
  const tag = t(`tags.${row.tag}`);
  const meta = [tag, row.city].filter(Boolean).join(' · ');
  const rel = row.lastVisitAt !== null ? relativePast(row.lastVisitAt, now) : null;
  const visit = rel ? t('list.lastVisit', { when: t(rel.key, { count: rel.count }) }) : t('list.noVisit');
  const spent = row.lifetimeSpendPaise > 0 ? t('list.spent', { amount: formatINR(row.lifetimeSpendPaise) }) : null;
  const due = row.nextFollowUpAt !== null && row.nextFollowUpAt <= now;

  return (
    <View style={[styles.row, { paddingStart: space.lg, paddingEnd: space.sm, gap: space.md }]}>
      <Pressable
        testID={`customer-row-${row.id}`}
        onPress={() => onPress(row)}
        accessibilityRole="button"
        accessibilityLabel={[t('list.rowLabel', { name: row.name, tag: meta, visit, spent: spent ?? '' }), due ? t('list.dueBadge') : '']
          .filter(Boolean)
          .join('. ')}
        style={({ pressed }) => [styles.main, { gap: space.md, paddingVertical: space.md }, pressed && { backgroundColor: colors.surfaceSunken }]}>
        <Avatar name={row.name} color={avatarTint(row.id, row.favouriteColour, accents)} size={44} />
        <View style={styles.text}>
          <AppText weight="semibold" numberOfLines={1}>
            {row.name}
          </AppText>
          <AppText variant="small" muted numberOfLines={1}>
            {meta}
          </AppText>
          <View style={[styles.line, { gap: space.sm }]}>
            {due ? (
              <View style={[styles.badge, { gap: space.xxs, backgroundColor: colors.surfaceSunken, paddingHorizontal: space.xs, borderRadius: 6 }]}>
                <Icon name="alarm" size={14} tone="primary" />
                <AppText variant="caption" weight="bold" tone="primary">
                  {t('list.dueBadge')}
                </AppText>
              </View>
            ) : null}
            <AppText variant="small" muted numberOfLines={1} style={styles.shrink}>
              {visit}
            </AppText>
          </View>
          {spent ? (
            <AppText variant="small" weight="semibold" numeric numberOfLines={1}>
              {spent}
            </AppText>
          ) : null}
        </View>
      </Pressable>
      {row.phone ? (
        <View style={styles.actions}>
          <IconButton icon="chat" variant="tonal" accessibilityLabel={t('list.whatsapp', { name: row.name })} onPress={() => onWhatsApp(row)} testID={`customer-wa-${row.id}`} />
          <IconButton icon="call" accessibilityLabel={t('list.call', { name: row.name })} onPress={() => onCall(row)} testID={`customer-call-${row.id}`} />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 72 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  text: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center' },
  shrink: { flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center' },
});
