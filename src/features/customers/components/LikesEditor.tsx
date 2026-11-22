import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CRAFTS } from '@/db/seed';
import type { CustomerLikes } from '@/db/schema';
import { AppText, ChipGroup, ColourSwatch } from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { shawlSwatches } from '@/ui/tokens';

import { BUDGET_PRESETS, budgetPresetOf, hasBudget, toggleColour, withBudget } from '../logic/customerLogic';
import { useBudgetLabel } from './likesText';

const CUSTOM = '__custom';
const ANY = '__any';

/** Tap-only likes editor: colour swatches, craft chips and a budget band. No typing. */
export function LikesEditor({ likes, onChange, testID }: { likes: CustomerLikes; onChange: (likes: CustomerLikes) => void; testID?: string }) {
  const { space } = useTheme();
  const { t } = useTranslation('customers');
  const budgetLabel = useBudgetLabel();

  // Crafts saved earlier that are not on the standard list stay selectable.
  const craftOptions = [...new Set<string>([...CRAFTS, ...likes.crafts])];
  const selectedCrafts = craftOptions.filter((c) => likes.crafts.some((x) => x.toLowerCase() === c.toLowerCase()));

  const preset = budgetPresetOf(likes);
  const custom = hasBudget(likes) && !preset;
  const budgetValue = preset ? preset.key : custom ? CUSTOM : ANY;
  const budgetOptions = [
    { value: ANY, label: t('likes.budgetAny') },
    ...BUDGET_PRESETS.map((p) => ({ value: p.key, label: t(`likes.budgetPresets.${p.key}`) })),
    ...(custom ? [{ value: CUSTOM, label: budgetLabel(likes.budgetMinPaise ?? 0, likes.budgetMaxPaise ?? 0) }] : []),
  ];

  return (
    <View testID={testID} style={{ gap: space.lg }}>
      <View style={{ gap: space.sm }}>
        <AppText weight="semibold">{t('likes.colours')}</AppText>
        <View style={[styles.wrap, { gap: space.md }]} accessibilityLabel={t('likes.colours')}>
          {shawlSwatches.map((s) => (
            <ColourSwatch
              key={s.key}
              testID={testID ? `${testID}-colour-${s.key}` : undefined}
              hex={s.hex}
              name={s.name}
              size={36}
              showName
              selected={likes.colours.includes(s.key)}
              onPress={() => onChange(toggleColour(likes, s.key))}
            />
          ))}
        </View>
      </View>
      <View style={{ gap: space.sm }}>
        <AppText weight="semibold">{t('likes.crafts')}</AppText>
        <ChipGroup
          testID={testID ? `${testID}-crafts` : undefined}
          mode="multi"
          accessibilityLabel={t('likes.crafts')}
          options={craftOptions.map((c) => ({ value: c, label: c }))}
          value={selectedCrafts}
          onChange={(crafts) => onChange({ ...likes, crafts })}
        />
      </View>
      <View style={{ gap: space.sm }}>
        <AppText weight="semibold">{t('likes.budget')}</AppText>
        <ChipGroup
          testID={testID ? `${testID}-budget` : undefined}
          mode="single"
          accessibilityLabel={t('likes.budget')}
          options={budgetOptions}
          value={budgetValue}
          onChange={(v) => {
            if (v === CUSTOM) return;
            const p = BUDGET_PRESETS.find((x) => x.key === v);
            onChange(withBudget(likes, p ? p.minPaise : null, p ? p.maxPaise : null));
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
