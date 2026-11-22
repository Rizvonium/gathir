import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Colour } from '@/db/schema';
import { AppText, Button, ColourSwatch, PieceBadge, Stepper } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export type ColourStockRowProps = {
  colour: Colour;
  oneOfAKind: boolean;
  lowThreshold: number;
  /** Bumped by the parent after the reason sheet closes: the stepper re-syncs to the saved count. */
  resetKey: number;
  onRestock: (colourId: string, qty: number) => void;
  /** "−" pressed: ask why. `qty` grows while "−" is held. */
  onRequestReduce: (colour: Colour, qty: number) => void;
  onSell: (colourId: string) => void;
};

/**
 * One colour: swatch, name, big count with − / + steppers. "+" restocks straight away;
 * "−" never changes the count by itself, it asks for a reason first. One-of-a-kind pieces
 * show their state and a Sell button instead.
 */
export function ColourStockRow({ colour, oneOfAKind, lowThreshold, resetKey, onRestock, onRequestReduce, onSell }: ColourStockRowProps) {
  const { space } = useTheme();
  const { t } = useTranslation('stock');
  // The value the stepper last showed, and the count we expect the database to hold.
  const shown = useRef(colour.pieces);
  const expected = useRef(colour.pieces);

  useEffect(() => {
    shown.current = colour.pieces;
    expected.current = colour.pieces;
  }, [resetKey, colour.pieces]);

  const onChange = (next: number) => {
    const up = next > shown.current;
    shown.current = next;
    if (up) {
      expected.current += 1;
      onRestock(colour.id, 1);
    } else {
      onRequestReduce(colour, Math.max(1, expected.current - next));
    }
  };

  if (oneOfAKind) {
    const available = colour.pieces > 0;
    return (
      <View style={[styles.row, { gap: space.md, paddingVertical: space.sm }]}>
        <ColourSwatch hex={colour.hex} name={colour.name} size={36} />
        <View style={[styles.text, { gap: space.xxs }]}>
          <AppText weight="semibold">{colour.name}</AppText>
          <PieceBadge count={colour.pieces} lowThreshold={lowThreshold} size="sm" />
        </View>
        {available ? (
          <Button label={t('detail.sell')} icon="sell" onPress={() => onSell(colour.id)} />
        ) : (
          <Button label={t('detail.backInStock')} icon="add" variant="tonal" onPress={() => onRestock(colour.id, 1)} />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.row, { gap: space.md, paddingVertical: space.sm }]} testID={`colour-row-${colour.id}`}>
      <ColourSwatch hex={colour.hex} name={colour.name} size={36} />
      <View style={styles.text}>
        <AppText weight="semibold" numberOfLines={2}>
          {colour.name}
        </AppText>
      </View>
      <Stepper
        key={resetKey}
        testID={`stepper-${colour.id}`}
        size="md"
        value={colour.pieces}
        onChange={onChange}
        accessibilityLabel={t('detail.colourPieces', { name: colour.name })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64 },
  text: { flex: 1, minWidth: 0 },
});
