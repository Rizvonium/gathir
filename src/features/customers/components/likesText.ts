/** Display text for likes and budgets (i18n + money formatting). */
import { useTranslation } from 'react-i18next';

import { formatINR } from '@/lib/money';

import { BUDGET_PRESETS, OPEN_MAX_PAISE, swatchName } from '../logic/customerLogic';

export function useBudgetLabel() {
  const { t } = useTranslation('customers');
  return (min: number, max: number): string => {
    const preset = BUDGET_PRESETS.find((p) => p.minPaise === min && p.maxPaise === max);
    if (preset) return t(`likes.budgetPresets.${preset.key}`);
    if (max >= OPEN_MAX_PAISE) return t('likes.budgetFrom', { min: formatINR(min) });
    if (min === max) return formatINR(min);
    return t('likes.budgetRange', { min: formatINR(min), max: formatINR(max) });
  };
}

/** "Sozni, Kani, maroon" for the learned-likes line (colour names in lower case read naturally). */
export function joinLikes(crafts: readonly string[], colours: readonly string[]): string {
  return [...crafts, ...colours.map((c) => swatchName(c).toLocaleLowerCase())].join(', ');
}
