import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DeletedCustomerRow } from '@/db/repo/customerQueries';
import type { DeletedProductRow } from '@/db/repo/productLifecycle';
import { formatPhone } from '@/lib/phone';
import { thumbUri } from '@/lib/photos';
import { AppText, Avatar, Button, EmptyState, IconButton, Screen, SectionHeader, Thumbnail } from '@/ui/components';
import { LoomEmptyState, PatternPlaceholder } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

import { useRecentlyDeletedScreen } from '../hooks/useRecentlyDeletedScreen';
import { deletedAgeDays } from '../logic/view';

type Item =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'product'; key: string; row: DeletedProductRow }
  | { kind: 'customer'; key: string; row: DeletedCustomerRow };

const THUMB = 56;

/** Products and customers deleted in the last 30 days, each with Restore (PLAN §3, §5). */
export function RecentlyDeletedScreen() {
  const { colors, space, radius } = useTheme();
  const { t } = useTranslation('stock');
  const s = useRecentlyDeletedScreen();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/stock'));

  const items: Item[] = [
    ...(s.products.length > 0 ? [{ kind: 'header' as const, key: 'h-p', title: t('deleted.products') }] : []),
    ...s.products.map((row) => ({ kind: 'product' as const, key: `p-${row.id}`, row })),
    ...(s.customers.length > 0 ? [{ kind: 'header' as const, key: 'h-c', title: t('deleted.customers') }] : []),
    ...s.customers.map((row) => ({ kind: 'customer' as const, key: `c-${row.id}`, row })),
  ];

  const daysLeft = (purgeAt: number) => {
    const days = deletedAgeDays(purgeAt, s.now);
    return days <= 1 ? t('deleted.lastDay') : t('deleted.daysLeft', { count: days });
  };

  const renderRow = (leading: ReactNode, title: string, subtitle: string, onRestore: () => void) => (
    <View style={[styles.row, { gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm }]}>
      {leading}
      <View style={styles.text}>
        <AppText weight="semibold" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="small" muted numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      <Button label={t('deleted.restore')} icon="restore" variant="tonal" size="sm" onPress={onRestore} accessibilityHint={t('deleted.restoreA11y', { name: title })} />
    </View>
  );

  return (
    <Screen
      title={t('deleted.title')}
      subtitle={t('deleted.subtitle')}
      padded={false}
      edges={['top', 'bottom']}
      leading={<IconButton icon="arrow-back" accessibilityLabel={t('detail.back')} onPress={back} />}>
      {s.empty ? (
        <EmptyState illustration={<LoomEmptyState width={200} height={120} />} title={t('deleted.emptyTitle')} body={t('deleted.emptyBody')} />
      ) : (
        <FlashList
          data={items}
          keyExtractor={(i) => i.key}
          getItemType={(i) => i.kind}
          contentContainerStyle={{ paddingBottom: space.xxl }}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg }}>
                  <SectionHeader title={item.title} />
                </View>
              );
            }
            if (item.kind === 'product') {
              const r = item.row;
              const leading = r.coverThumb ? (
                <Thumbnail uri={thumbUri(r.coverThumb)} size={THUMB} recyclingKey={r.id} />
              ) : (
                <PatternPlaceholder productId={r.id} name={r.name} width={THUMB} height={THUMB} radius={radius.md} />
              );
              const subtitle = [r.code, r.piecesDeleted > 0 ? t('deleted.pieces', { count: r.piecesDeleted }) : null, daysLeft(r.purgeAt)]
                .filter(Boolean)
                .join(' · ');
              return renderRow(leading, r.name, subtitle, () => s.restoreProduct(r.id, r.name));
            }
            const c = item.row;
            const subtitle = [c.phone ? formatPhone(c.phone) : null, daysLeft(c.purgeAt)].filter(Boolean).join(' · ');
            return renderRow(<Avatar name={c.name} color={colors.indigo} size={THUMB} />, c.name, subtitle, () => s.restoreCustomer(c.id, c.name));
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 72 },
  text: { flex: 1, minWidth: 0 },
});
