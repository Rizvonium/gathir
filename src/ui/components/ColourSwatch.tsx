import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type Theme } from '../theme';
import { touchTarget } from '../tokens';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

/** Value used by shawlSwatches for "Multicolour". */
export const MULTI_COLOUR = 'multi';

export type ColourSwatchProps = {
  /** #RRGGBB, or 'multi' for a multicolour shawl. */
  hex: string;
  /** Colour name; always used for TalkBack, shown under the circle when `showName`. */
  name: string;
  size?: number;
  selected?: boolean;
  onPress?: () => void;
  showName?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const RING = 2;
const GAP = 2;

/**
 * Round colour sample. 'multi' draws diagonal jewel-tone stripes. A 1px border keeps white
 * and cream visible; the selected ring space is always reserved so selection never shifts layout.
 */
export function ColourSwatch({ hex, name, size = 32, selected = false, onPress, showName = false, testID, style }: ColourSwatchProps) {
  const theme = useTheme();
  const { colors, space } = theme;
  const outer = size + 2 * (RING + GAP);

  const circle = (
    <View
      style={[
        styles.ring,
        { width: outer, height: outer, borderRadius: outer / 2, borderColor: selected ? colors.primary : 'transparent' },
      ]}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, borderColor: colors.border },
          hex !== MULTI_COLOUR && { backgroundColor: hex },
        ]}>
        {hex === MULTI_COLOUR ? <MultiStripes size={size} theme={theme} /> : null}
      </View>
    </View>
  );

  const content = (
    <View style={[styles.column, { gap: space.xs }]}>
      {circle}
      {showName ? (
        <AppText variant="caption" align="center" numberOfLines={1} style={{ maxWidth: Math.max(outer, 64) }}>
          {name}
        </AppText>
      ) : null}
    </View>
  );

  if (!onPress) {
    return (
      <View testID={testID} accessible accessibilityLabel={name} style={style}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      haptic="selection"
      accessibilityLabel={name}
      accessibilityState={{ selected }}
      hitSlop={Math.max(0, (touchTarget - outer) / 2)}
      style={style}>
      {content}
    </PressableScale>
  );
}

function MultiStripes({ size, theme }: { size: number; theme: Theme }) {
  const { colors } = theme;
  const stripes = [colors.primary, colors.saffron, colors.meadow, colors.teal, colors.indigo, colors.rose];
  const span = size * 1.5;
  return (
    <View
      style={{
        position: 'absolute',
        width: span,
        height: span,
        top: (size - span) / 2,
        start: (size - span) / 2,
        flexDirection: 'row',
        transform: [{ rotate: '45deg' }],
      }}>
      {stripes.map((c) => (
        <View key={c} style={{ flex: 1, backgroundColor: c }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center' },
  ring: { borderWidth: RING, alignItems: 'center', justifyContent: 'center' },
  circle: { borderWidth: 1, overflow: 'hidden' },
});
