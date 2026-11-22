import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { ProductListRow } from '@/db/repo/productQueries';
import { thumbUri } from '@/lib/photos';
import { formatINR } from '@/lib/money';
import { AppText, ColourDots, Icon, PieceBadge, PressableScale, stockStatusOf, Thumbnail, warmShadow } from '@/ui/components';
import { PatternPlaceholder } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

import { useItemMotion } from '../hooks/useItemMotion';

export type ProductGridCardProps = {
  row: ProductListRow;
  lowThreshold: number;
  selecting: boolean;
  selected: boolean;
  /** The Stock screen is on top (plays the save pop only when seen). */
  focused: boolean;
  onPress: (row: ProductListRow) => void;
  onLongPress: (row: ProductListRow) => void;
};

/** Photo-first stock card: cover (or pattern art), name, rate, piece badge and colour dots. */
export function ProductGridCard({ row, lowThreshold, selecting, selected, focused, onPress, onLongPress }: ProductGridCardProps) {
  const { colors, space, radius, scheme } = useTheme();
  const { t } = useTranslation('stock');
  const { style: motion } = useItemMotion(row.id, focused);
  const status = stockStatusOf(row.totalPieces, lowThreshold);
  const label = t('card.a11y', {
    name: row.name,
    rate: formatINR(row.ratePaise),
    status: t(`ui:pieceBadge.a11y.${status}`, { count: row.totalPieces }),
  });

  return (
    <Animated.View style={[styles.cell, { padding: space.xs }, motion]}>
      <PressableScale
        testID={`product-card-${row.id}`}
        onPress={() => onPress(row)}
        onLongPress={() => onLongPress(row)}
        delayLongPress={350}
        accessibilityLabel={label}
        accessibilityHint={selecting ? undefined : t('card.hint')}
        accessibilityState={selecting ? { selected } : undefined}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: selected ? colors.primary : colors.border,
            borderWidth: selected ? 2 : 1,
            borderRadius: radius.card,
          },
          warmShadow(scheme),
        ]}>
        <View style={[styles.photo, { backgroundColor: colors.surfaceSunken }]}>
          {row.coverThumb ? (
            <Thumbnail uri={thumbUri(row.coverThumb)} recyclingKey={row.id} rounded="sm" style={styles.fill} />
          ) : (
            <PatternPlaceholder productId={row.id} name={row.name} radius={0} />
          )}
          {row.oneOfAKind ? (
            <View style={[styles.tag, { backgroundColor: colors.indigo, borderRadius: radius.pill, paddingHorizontal: space.sm, top: space.sm, start: space.sm }]}>
              <AppText variant="caption" weight="bold" color={colors.onAccent}>
                {t('card.oneOfAKind')}
              </AppText>
            </View>
          ) : null}
          {selecting ? (
            <View
              style={[
                styles.check,
                { top: space.sm, end: space.sm, borderColor: colors.surface, backgroundColor: selected ? colors.primary : colors.scrim },
              ]}>
              {selected ? <Icon name="check" size={20} color={colors.onPrimary} /> : null}
            </View>
          ) : null}
        </View>
        <View style={{ padding: space.md, gap: space.xs }}>
          <AppText variant="small" weight="semibold" numberOfLines={2}>
            {row.name}
          </AppText>
          <AppText variant="body" weight="bold" numeric>
            {formatINR(row.ratePaise)}
          </AppText>
          <PieceBadge count={row.totalPieces} lowThreshold={lowThreshold} size="sm" />
          {row.colours.length > 0 ? (
            <ColourDots items={row.colours.map((c) => ({ key: c.id, hex: c.hex, name: c.name, count: c.pieces }))} max={4} />
          ) : null}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1 },
  card: { overflow: 'hidden', flex: 1 },
  photo: { width: '100%', aspectRatio: 4 / 5, overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  tag: { position: 'absolute', paddingVertical: 2 },
  check: { position: 'absolute', width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
