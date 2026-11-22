/**
 * Phone helpers (libphonenumber-js). Phones are stored in E.164 ("+919876543210").
 * India (+91) is the default country; numbers typed with "+" keep their own country code.
 */
import { AsYouType, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export const DEFAULT_COUNTRY: CountryCode = 'IN';

function parse(input: string, country: CountryCode) {
  const trimmed = input.trim();
  if (trimmed === '') return undefined;
  // "0091…" is a common way to type the international prefix.
  const normalised = trimmed.startsWith('00') ? `+${trimmed.slice(2)}` : trimmed;
  return parsePhoneNumberFromString(normalised, country);
}

/** Valid number → E.164 ("+919876543210"); anything else → null. */
export function toE164(input: string, country: CountryCode = DEFAULT_COUNTRY): string | null {
  const parsed = parse(input, country);
  return parsed && parsed.isValid() ? parsed.number : null;
}

/** True when the input is a valid phone number for the country (or its own "+" code). */
export function isValidPhone(input: string, country: CountryCode = DEFAULT_COUNTRY): boolean {
  return toE164(input, country) !== null;
}

/**
 * Human display: grouped national digits without trunk "0" for the default country
 * ("98765 43210"), international for others ("+44 7400 123456"). Unparsable input is returned as is.
 */
export function formatPhone(e164OrInput: string, country: CountryCode = DEFAULT_COUNTRY): string {
  const parsed = parse(e164OrInput, country);
  if (!parsed) return e164OrInput;
  const intl = parsed.formatInternational();
  return parsed.country === country ? intl.replace(/^\+\d+\s/, '') : intl;
}

/** Always "+91 98765 43210" style. Returns the input unchanged when unparsable. */
export function formatPhoneInternational(e164OrInput: string, country: CountryCode = DEFAULT_COUNTRY): string {
  const parsed = parse(e164OrInput, country);
  return parsed ? parsed.formatInternational() : e164OrInput;
}

/** Formats partial input while typing ("98765" → "98765", "9876543210" → "98765 43210"). */
export function formatPhoneAsYouType(input: string, country: CountryCode = DEFAULT_COUNTRY): string {
  return new AsYouType(country).input(input);
}

/** Digits only, without "+" ("919876543210"): the form wa.me links expect. Null when invalid. */
export function toWhatsAppNumber(input: string, country: CountryCode = DEFAULT_COUNTRY): string | null {
  const e164 = toE164(input, country);
  return e164 ? e164.slice(1) : null;
}

/** National significant digits of an E.164 number for the given country ("+919876543210" → "9876543210"). */
export function nationalDigits(e164: string, country: CountryCode = DEFAULT_COUNTRY): string {
  const parsed = parse(e164, country);
  return parsed ? (parsed.country === country ? parsed.nationalNumber : parsed.number) : e164.replace(/[^\d+]/g, '');
}

/** "+91" for IN: the prefix shown in front of a national number. */
export function callingCodePrefix(country: CountryCode = DEFAULT_COUNTRY): string {
  return `+${getCountryCallingCode(country)}`;
}
