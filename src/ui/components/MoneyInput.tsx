import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { parseRupeesInput } from '@/lib/money';
import { formatMoneyTyping, paiseToInputText } from './moneyInputText';
import { TextField, type TextFieldProps } from './TextField';

export type MoneyInputProps = {
  label: string;
  /** Amount in paise; null when empty. */
  value: number | null;
  /** Called with paise (null when empty or not a number) on every keystroke. */
  onChange: (paise: number | null) => void;
  helper?: string;
  error?: string;
  placeholder?: string;
  autoFocus?: boolean;
  editable?: boolean;
  onSubmitEditing?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  ref?: TextFieldProps['ref'];
};

/**
 * Rupee amount field: "₹" prefix, decimal keypad, Indian grouping while typing
 * ("125000" shows "1,25,000"), value reported in integer paise via src/lib/money.ts.
 */
export function MoneyInput({ label, value, onChange, helper, error, placeholder, autoFocus, editable, onSubmitEditing, testID, style, ref }: MoneyInputProps) {
  const { t } = useTranslation('ui');
  const [text, setText] = useState(() => paiseToInputText(value));
  const [lastValue, setLastValue] = useState(value);

  // Adopt outside changes (e.g. a rate pre-filled from the product) without fighting the user's typing.
  if (value !== lastValue) {
    setLastValue(value);
    if (value !== parseRupeesInput(text)) setText(paiseToInputText(value));
  }

  const handleChange = (raw: string) => {
    const next = formatMoneyTyping(raw);
    const paise = parseRupeesInput(next);
    setText(next);
    setLastValue(paise);
    onChange(paise);
  };

  return (
    <TextField
      ref={ref}
      testID={testID}
      label={label}
      helper={helper}
      error={error}
      prefix={t('money.prefix')}
      value={text}
      onChangeText={handleChange}
      keyboardType="decimal-pad"
      inputMode="decimal"
      placeholder={placeholder ?? '0'}
      autoFocus={autoFocus}
      editable={editable}
      onSubmitEditing={onSubmitEditing}
      numeric
      align="end"
      style={style}
    />
  );
}
