import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Colour } from '@/db/schema';
import { AppSheet, AppText, Stepper } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { REDUCE_CHOICES, REDUCE_ICONS, type ReduceChoice } from '../logic/view';
import { SheetOption } from './SheetOption';

export type ReduceTarget = { colour: Colour; qty: number };

export type ReduceSheetProps = {
  target: ReduceTarget | null;
  onQty: (qty: number) => void;
  onPick: (reason: ReduceChoice) => void;
  onClose: () => void;
};

/**
 * "Why fewer pieces?" One tap on a reason commits (Sold opens the Sell sheet instead), so
 * the history always says why a count went down.
 */
export function ReduceSheet({ target, onQty, onPick, onClose }: ReduceSheetProps) {
  const { space } = useTheme();
  const { t } = useTranslation('stock');
  const pieces = target?.colour.pieces ?? 0;
  return (
    <AppSheet visible={target !== null} onClose={onClose} title={t('reduce.title')} testID="reduce-sheet">
      {target ? (
        <View style={{ gap: space.md }}>
          <AppText muted>{t('reduce.subtitle', { colour: target.colour.name, count: pieces })}</AppText>
          {pieces > 1 ? (
            <View style={{ gap: space.xs, alignItems: 'flex-start' }}>
              <AppText variant="small" weight="semibold">
                {t('reduce.quantity')}
              </AppText>
              <Stepper
                testID="reduce-qty"
                size="md"
                min={1}
                max={pieces}
                value={Math.min(target.qty, pieces)}
                onChange={onQty}
                accessibilityLabel={t('reduce.quantity')}
              />
            </View>
          ) : null}
          <View accessibilityLabel={t('reduce.reasons')}>
            {REDUCE_CHOICES.map((r) => (
              <SheetOption key={r} testID={`reason-${r}`} icon={REDUCE_ICONS[r]} label={t(`reason.${r}`)} onPress={() => onPick(r)} />
            ))}
          </View>
          <SheetOption icon="close" label={t('reduce.cancel')} onPress={onClose} />
        </View>
      ) : null}
    </AppSheet>
  );
}
