import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Swipeable, { SwipeDirection, type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { ProductListRow } from '@/db/repo/productQueries';
import { formatINR } from '@/lib/money';
import { thumbUri } from '@/lib/photos';
import { AppText, ColourDots, Icon, IconButton, PieceBadge, PressableScale, stockStatusOf, Thumbnail } from '@/ui/components';
import { PatternPlaceholder } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

import { useItemMotion } from '../hooks/useItemMotion';

const THUMB = 64;
const ACTION_WIDTH = 104;

export type ProductRowProps = {
  row: ProductListRow;
  lowThreshold: number;
  selecting: boolean;
  selected: boolean;
  /** The Stock screen is on top (plays the save pop only when seen). */
  focused: boolean;
  onPress: (row: ProductListRow) => void;
  onLongPress: (row: ProductListRow) => void;
  onSellOne: (row: ProductListRow) => void;
  onDelete: (row: ProductListRow, collapseThen: (commit: () => void) => void) => void;
  onMenu: (row: ProductListRow) => void;
};

/**
 * Compact stock row. Swipe right = "Sell 1", swipe left = Delete (with Undo). Both have a
 * visible alternative in the row menu (⋮), and TalkBack gets them as custom actions.
 */
export function ProductRow({ row, lowThreshold, selecting, selected, focused, onPress, onLongPress, onSellOne, onDelete, onMenu }: ProductRowProps) {
  const { colors, space, radius } = useTheme();
  const { t } = useTranslation('stock');
  const swipe = useRef<SwipeableMethods>(null);
  const { style: motion, collapseThen } = useItemMotion(row.id, focused);
  const status = stockStatusOf(row.totalPieces, lowThreshold);
  const canSell = row.totalPieces > 0;
  const label = t('card.a11y', {
    name: row.name,
    rate: formatINR(row.ratePaise),
    status: t(`ui:pieceBadge.a11y.${status}`, { count: row.totalPieces }),
  });

  const onOpen = (direction: SwipeDirection) => {
    swipe.current?.close();
    if (direction === SwipeDirection.RIGHT) onSellOne(row);
    else onDelete(row, collapseThen);
  };

  const action = (kind: 'sell' | 'delete') => {
    const sell = kind === 'sell';
    return (
      <View
        style={[
          styles.action,
          {
            width: ACTION_WIDTH,
            backgroundColor: sell ? (canSell ? colors.meadow : colors.surfaceSunken) : colors.danger,
            alignItems: sell ? 'flex-start' : 'flex-end',
            paddingHorizontal: space.lg,
            gap: space.xxs,
          },
        ]}
        importantForAccessibility="no-hide-descendants">
        <Icon name={sell ? 'sell' : 'delete-outline'} color={sell && !canSell ? colors.textMuted : colors.onAccent} />
        <AppText variant="caption" weight="bold" color={sell && !canSell ? colors.textMuted : colors.onAccent}>
          {sell ? (canSell ? t('row.sellOne') : t('row.soldOut')) : t('common:actions.delete')}
        </AppText>
      </View>
    );
  };

  return (
    <Animated.View style={motion}>
      <Swipeable
        ref={swipe}
        enabled={!selecting}
        friction={1.6}
        leftThreshold={ACTION_WIDTH * 0.8}
        rightThreshold={ACTION_WIDTH * 0.8}
        overshootLeft={false}
        overshootRight={false}
        renderLeftActions={() => action('sell')}
        renderRightActions={() => action('delete')}
        onSwipeableOpen={onOpen}
        childrenContainerStyle={{ backgroundColor: colors.bg }}>
        <View style={[styles.row, { paddingVertical: space.sm, gap: space.md }]}>
          <PressableScale
            testID={`product-row-${row.id}`}
            scaleTo={1}
            onPress={() => onPress(row)}
            onLongPress={() => onLongPress(row)}
            delayLongPress={350}
            accessibilityLabel={label}
            accessibilityState={selecting ? { selected } : undefined}
            accessibilityActions={[
              { name: 'sell', label: t('rowMenu.sell') },
              { name: 'delete', label: t('rowMenu.delete') },
            ]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'sell') onSellOne(row);
              if (e.nativeEvent.actionName === 'delete') onDelete(row, collapseThen);
            }}
            style={[styles.main, { gap: space.md, paddingStart: space.lg }]}>
            <View style={[styles.thumb, { borderRadius: radius.md, borderColor: selected ? colors.primary : 'transparent' }]}>
              {row.coverThumb ? (
                <Thumbnail uri={thumbUri(row.coverThumb)} size={THUMB} recyclingKey={row.id} />
              ) : (
                <PatternPlaceholder productId={row.id} name={row.name} width={THUMB} height={THUMB} radius={radius.md} />
              )}
              {selecting && selected ? (
                <View style={[styles.checkOverlay, { backgroundColor: colors.scrim, borderRadius: radius.md }]}>
                  <Icon name="check-circle" size={28} color={colors.onPrimary} />
                </View>
              ) : null}
            </View>
            <View style={[styles.text, { gap: space.xxs }]}>
              <AppText weight="semibold" numberOfLines={1}>
                {row.name}
              </AppText>
              <View style={[styles.line, { gap: space.sm }]}>
                <AppText variant="small" weight="bold" numeric>
                  {formatINR(row.ratePaise)}
                </AppText>
                <PieceBadge count={row.totalPieces} lowThreshold={lowThreshold} size="sm" />
              </View>
              {row.colours.length > 1 ? (
                <ColourDots items={row.colours.map((c) => ({ key: c.id, hex: c.hex, name: c.name, count: c.pieces }))} max={5} />
              ) : null}
            </View>
          </PressableScale>
          {selecting ? null : (
            <IconButton icon="more-vert" accessibilityLabel={t('row.menu', { name: row.name })} onPress={() => onMenu(row)} style={{ marginEnd: space.xs }} />
          )}
        </View>
      </Swipeable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 80 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  thumb: { width: THUMB + 4, height: THUMB + 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  action: { justifyContent: 'center' },
});
