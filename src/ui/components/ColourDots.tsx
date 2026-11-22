import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import { ColourSwatch } from './ColourSwatch';

export type ColourDot = {
  key: string;
  /** #RRGGBB or 'multi'. */
  hex: string;
  name: string;
  /** Pieces in this colour; omit to show only the dot. */
  count?: number;
};

export type ColourDotsProps = {
  items: ColourDot[];
  /** Dots shown before collapsing into "+N". Default 5. */
  max?: number;
  style?: StyleProp<ViewStyle>;
};

/** Compact row of small swatches with mini counts (product cards). Read as one TalkBack label. */
export function ColourDots({ items, max = 5, style }: ColourDotsProps) {
  const { space } = useTheme();
  const { t } = useTranslation('ui');
  const shown = items.slice(0, max);
  const hidden = items.length - shown.length;
  const label = items
    .map((i) => (i.count === undefined ? i.name : t('colourDots.item', { name: i.name, count: i.count })))
    .join(', ');

  return (
    <View accessible accessibilityLabel={label} style={[styles.row, { gap: space.sm }, style]}>
      {shown.map((i) => (
        <View key={i.key} style={[styles.item, { gap: space.xxs }]} importantForAccessibility="no-hide-descendants">
          <ColourSwatch hex={i.hex} name={i.name} size={14} />
          {i.count !== undefined ? (
            <AppText variant="caption" numeric muted>
              {i.count}
            </AppText>
          ) : null}
        </View>
      ))}
      {hidden > 0 ? (
        <AppText variant="caption" muted numeric importantForAccessibility="no">
          {t('colourDots.more', { count: hidden })}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  item: { flexDirection: 'row', alignItems: 'center' },
});
