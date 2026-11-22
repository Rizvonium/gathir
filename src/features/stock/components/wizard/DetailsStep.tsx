import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CRAFTS, MATERIALS, SIZES } from '@/db/seed';
import { Button, Chip, MoneyInput, TextField } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import type { ProductWizard } from '../../hooks/useProductWizard';
import { costWarnings, setFields, toggleValue } from '../../logic/draft';
import { ChoiceChips } from './ChoiceChips';

const asOptions = (list: readonly string[]) => list.map((v) => ({ value: v, label: v }));

/**
 * Step 2: tap chips first (they build the name), then the rate and the buying price (seller-only,
 * optional; it is what profit is worked out from). Notes stay folded.
 */
export function DetailsStep({ w }: { w: ProductWizard }) {
  const { space } = useTheme();
  const { t } = useTranslation('stock');
  const d = w.draft;
  const warn = costWarnings(d);
  const [showNotes, setShowNotes] = useState(d.notes !== '');
  const set = (patch: Parameters<typeof setFields>[1]) => w.update((cur) => setFields(cur, patch));

  return (
    <View style={{ gap: space.xl }}>
      {w.categories.length > 0 ? (
        <ChoiceChips
          testID="wizard-category"
          label={t('wizard.details.category')}
          options={w.categories.map((c) => ({ value: c.id, label: c.name }))}
          value={d.categoryId ?? ''}
          onChange={(v) => set({ categoryId: v || null })}
        />
      ) : null}
      <ChoiceChips testID="wizard-craft" label={t('wizard.details.craft')} options={asOptions(CRAFTS)} value={d.craft} onChange={(v) => set({ craft: v })} />
      <ChoiceChips label={t('wizard.details.material')} options={asOptions(MATERIALS)} value={d.material} onChange={(v) => set({ material: v })} />

      <View style={{ gap: space.sm }}>
        <TextField
          testID="wizard-name"
          label={t('wizard.details.name')}
          value={d.name}
          placeholder={w.suggestions[0] ?? t('wizard.details.namePlaceholder')}
          onChangeText={(name) => set({ name })}
          helper={t('wizard.details.nameHelper')}
          error={w.errors.name ? t(`wizard.errors.${w.errors.name}`) : undefined}
          autoCapitalize="words"
          maxLength={80}
        />
        {w.suggestions.length > 0 ? (
          <View accessibilityLabel={t('wizard.details.suggestions')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {w.suggestions.map((s) => (
              <Chip key={s} label={s} icon="auto-awesome" selected={d.name === s} onPress={() => set({ name: toggleValue(d.name, s) })} />
            ))}
          </View>
        ) : null}
      </View>

      <ChoiceChips label={t('wizard.details.size')} options={asOptions(SIZES)} value={d.size} onChange={(v) => set({ size: v })} />

      <MoneyInput
        testID="wizard-rate"
        label={t('wizard.details.rate')}
        value={d.ratePaise}
        onChange={(ratePaise) => set({ ratePaise })}
        helper={t('wizard.details.rateHelper')}
        error={w.errors.rate ? t(`wizard.errors.${w.errors.rate}`) : undefined}
      />

      <MoneyInput
        testID="wizard-cost"
        label={t('wizard.details.cost')}
        value={d.costPaise}
        onChange={(costPaise) => set({ costPaise })}
        helper={warn.rateBelowCost ? t('wizard.details.costAboveRate') : t('wizard.details.costHelper')}
      />

      {showNotes ? (
        <TextField
          label={t('wizard.details.notes')}
          value={d.notes}
          placeholder={t('wizard.details.notesPlaceholder')}
          onChangeText={(notes) => set({ notes })}
          multiline
          maxLength={500}
        />
      ) : (
        <Button label={t('wizard.details.addNotes')} icon="notes" variant="ghost" onPress={() => setShowNotes(true)} style={{ alignSelf: 'flex-start' }} />
      )}
    </View>
  );
}
