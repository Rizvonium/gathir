/**
 * What a customer reads over the photo: name, craft, colours in stock, rate and availability.
 * Never cost, history or sales. Big type, light ink on a soft scrim so any photo stays readable.
 */
import { StyleSheet, View } from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type { ProductListRow } from '@/db/repo/productQueries';
import { formatINR, formatNumber } from '@/lib/money';
import { AppText, Button, ColourSwatch, Icon, type IconName } from '@/ui/components';
import { darkColors } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

import { showroomAvailability, type ShowroomAvailability } from '../logic/showroom';

/** The photo stage is always dark (a gallery wall), whatever the phone's theme. */
export const stage = darkColors;

const MAX_SWATCHES = 6;

export type ShowroomOverlayProps = {
  product: ProductListRow;
  index: number;
  total: number;
  lowStockLevel: number;
  showExactCounts: boolean;
  bottomInset: number;
  onSendMeThis: () => void;
};

export function availabilityText(t: TFunction<'showroom'>, a: ShowroomAvailability): string {
  if (a.kind === 'few') return t('availability.onlyLeft', { count: a.count });
  if (a.kind === 'count') return t('availability.pieces', { count: a.count, n: formatNumber(a.count) });
  if (a.kind === 'sold_out') return t('availability.soldOut');
  return t('availability.available');
}

export function ShowroomOverlay({ product, index, total, lowStockLevel, showExactCounts, bottomInset, onSendMeThis }: ShowroomOverlayProps) {
  const { t } = useTranslation('showroom');
  const { space, radius } = useTheme();
  const availability = showroomAvailability(product.totalPieces, lowStockLevel, showExactCounts);
  const colours = product.colours.filter((c) => c.pieces > 0);
  const meta = [product.craft, product.material, product.size].filter((s) => s && s.trim()).join(', ');
  const icon: IconName = availability.kind === 'few' ? 'hourglass-bottom' : 'check-circle';
  const tone = availability.kind === 'few' ? stage.saffron : stage.meadow;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.root,
        {
          paddingHorizontal: space.xl,
          paddingTop: space.xxxl * 2,
          paddingBottom: bottomInset + space.xl,
          gap: space.md,
          experimental_backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0) 0%, ${stage.scrim} 45%, ${stage.scrim} 100%)`,
        },
      ]}>
      <View style={{ gap: space.xs }} accessible accessibilityLabel={[product.name, meta].filter(Boolean).join('. ')}>
        <AppText variant="display" color={stage.text} numberOfLines={2}>
          {product.name}
        </AppText>
        {meta ? (
          <AppText variant="body" color={stage.textMuted} numberOfLines={1}>
            {meta}
          </AppText>
        ) : null}
      </View>

      {colours.length > 0 ? (
        <View
          style={[styles.row, { gap: space.sm }]}
          accessible
          accessibilityLabel={t('colours', { names: colours.map((c) => c.name).join(', ') })}>
          {colours.slice(0, MAX_SWATCHES).map((c) => (
            <View key={c.id} style={[styles.row, styles.swatch, { gap: space.xs, borderRadius: radius.pill, paddingEnd: space.sm, backgroundColor: stage.surface }]}>
              <ColourSwatch hex={c.hex} name={c.name} size={24} />
              <AppText variant="caption" weight="semibold" color={stage.text} numberOfLines={1}>
                {c.name}
              </AppText>
            </View>
          ))}
          {colours.length > MAX_SWATCHES ? (
            <AppText variant="caption" color={stage.textMuted}>
              {t('moreColours', { count: colours.length - MAX_SWATCHES })}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.row, styles.bottom, { gap: space.md }]} pointerEvents="box-none">
        <View style={[styles.flex, { gap: space.xs }]}>
          <AppText
            variant="count"
            weight="bold"
            numeric
            color={stage.text}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={product.ratePaise > 0 ? formatINR(product.ratePaise) : t('rateOnRequest')}>
            {product.ratePaise > 0 ? formatINR(product.ratePaise) : t('rateOnRequest')}
          </AppText>
          <View style={[styles.row, { gap: space.xs }]}>
            <Icon name={icon} size={18} color={tone} />
            <AppText weight="semibold" color={tone}>
              {availabilityText(t, availability)}
            </AppText>
            <AppText variant="small" color={stage.textMuted} style={{ marginStart: space.sm }}>
              {t('position', { index: index + 1, total })}
            </AppText>
          </View>
        </View>
        <Button testID="send-me-this" label={t('sendMeThis')} icon="favorite" size="lg" haptic="light" onPress={onSendMeThis} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', start: 0, end: 0, bottom: 0 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  bottom: { flexWrap: 'nowrap', alignItems: 'flex-end' },
  swatch: { padding: 2 },
  flex: { flex: 1, minWidth: 0 },
});
