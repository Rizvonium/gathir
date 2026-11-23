import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Colour } from '@/db/schema';
import { AppText, Button, ColourSwatch, PieceBadge, Stepper } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export type ColourStockRowProps = {
  colour: Colour;
  oneOfAKind: boolean;
  lowThreshold: number;
  /** Saves a restock; returns false when it failed (the caller shows why). */
  onRestock: (colourId: string, qty: number) => boolean;
  /** "−" pressed: ask why. `qty` grows while "−" is held. */
  onRequestReduce: (colour: Colour, qty: number) => void;
  onSell: (colourId: string) => void;
};

/**
 * One colour: swatch, name, big count with − / + steppers. "+" restocks straight away;
 * "−" never changes the count by itself, it asks for a reason first. One-of-a-kind pieces
 * show their state and a Sell button instead.
 */
export function ColourStockRow({ colour, oneOfAKind, lowThreshold, onRestock, onRequestReduce, onSell }: ColourStockRowProps) {
  const { space } = useTheme();
  const { t } = useTranslation('stock');

  // A "+" hold is saved once, when the finger lifts (one restock of n pieces, one history row),
  // not once per step: each write refreshes every open query. Until the saved count catches up
  // (the next frame), the row shows the new count optimistically so the number doesn't flicker back.
  const [optimistic, setOptimistic] = useState<{ from: number; shown: number } | null>(null);
  const shown = optimistic && optimistic.from === colour.pieces ? optimistic.shown : colour.pieces;

  // The stepper is controlled by the saved count. "+" saves straight away. "−" saves nothing: it
  // asks for a reason for (saved − shown) pieces; when the sheet closes the count is still the
  // saved one, so the stepper is back in sync on its own.
  const onChange = (next: number) => {
    if (next > shown) {
      // From the shown count: a restock may be saved but not yet read back.
      if (onRestock(colour.id, next - shown)) setOptimistic({ from: colour.pieces, shown: next });
      else setOptimistic(null);
    } else onRequestReduce(colour, Math.max(1, shown - next));
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
        testID={`stepper-${colour.id}`}
        size="md"
        value={shown}
        onChange={onChange}
        onHoldCommit={onChange}
        accessibilityLabel={t('detail.colourPieces', { name: colour.name })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64 },
  text: { flex: 1, minWidth: 0 },
});
