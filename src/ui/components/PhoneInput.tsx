import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CountryCode } from 'libphonenumber-js';

import { callingCodePrefix, DEFAULT_COUNTRY, formatPhone, formatPhoneAsYouType, toE164 } from '@/lib/phone';
import { TextField, type TextFieldProps } from './TextField';

export type PhoneInputProps = {
  label: string;
  /** Stored number in E.164 ("+919876543210") or '' when empty. */
  value: string;
  /** Every keystroke: E.164 when the number is valid, else null, plus the raw text. */
  onChange: (e164: string | null, text: string) => void;
  /** Default country for numbers typed without "+". Default IN (+91). */
  country?: CountryCode;
  helper?: string;
  /** Extra error from the screen (e.g. "Already saved"); invalid-number error is built in. */
  error?: string;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  ref?: TextFieldProps['ref'];
};

/**
 * Phone field with a "+91" prefix (hidden when the user types their own "+code"). Formats
 * as you type and validates with libphonenumber-js; shows "Check the number" after blur.
 */
export function PhoneInput({ label, value, onChange, country = DEFAULT_COUNTRY, helper, error, autoFocus, onSubmitEditing, testID, style, ref }: PhoneInputProps) {
  const { t } = useTranslation('ui');
  const [text, setText] = useState(() => (value ? formatPhone(value, country) : ''));
  const [lastValue, setLastValue] = useState(value);
  const [touched, setTouched] = useState(false);

  if (value !== lastValue) {
    setLastValue(value);
    if (value !== (toE164(text, country) ?? '')) setText(value ? formatPhone(value, country) : '');
  }

  const handleChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d+\s-]/g, '');
    // Re-format only when adding characters; deleting a space should not snap it back.
    const next = cleaned.length > text.length ? formatPhoneAsYouType(cleaned, country) : cleaned;
    const e164 = toE164(next, country);
    setText(next);
    setLastValue(e164 ?? '');
    onChange(e164, next);
  };

  const invalid = touched && text.trim() !== '' && toE164(text, country) === null;
  const international = text.trim().startsWith('+');

  return (
    <TextField
      ref={ref}
      testID={testID}
      label={label}
      helper={helper}
      error={error ?? (invalid ? t('phone.invalid') : undefined)}
      prefix={international ? undefined : callingCodePrefix(country)}
      value={text}
      onChangeText={handleChange}
      onBlur={() => setTouched(true)}
      keyboardType="phone-pad"
      inputMode="tel"
      autoComplete="tel"
      textContentType="telephoneNumber"
      placeholder={t('phone.placeholder')}
      autoFocus={autoFocus}
      onSubmitEditing={onSubmitEditing}
      numeric
      style={style}
    />
  );
}
