/** Pure text helpers for MoneyInput (kept separate so they are unit-testable). */

/** "1234567" → "12,34,567" (Indian grouping on a digit string, no precision loss). */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/**
 * Cleans what the user typed and regroups it: keeps digits and one ".", at most 2 decimals,
 * strips leading zeros. "125000" → "1,25,000"; "6500.5" → "6,500.5"; "abc" → "".
 */
export function formatMoneyTyping(text: string): string {
  const cleaned = text.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  const intRaw = dot === -1 ? cleaned : cleaned.slice(0, dot);
  const decimals = dot === -1 ? null : cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  const intDigits = intRaw.replace(/^0+(?=\d)/, '');
  const intPart = intDigits === '' && decimals !== null ? '0' : groupIndian(intDigits);
  return decimals === null ? intPart : `${intPart}.${decimals}`;
}

/** Paise → editable text: 650000 → "6,500"; 650050 → "6,500.50"; null → "". */
export function paiseToInputText(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || !Number.isFinite(paise)) return '';
  const rupees = Math.floor(Math.abs(paise) / 100);
  const rest = Math.abs(paise) % 100;
  const grouped = groupIndian(String(rupees));
  return rest === 0 ? grouped : `${grouped}.${String(rest).padStart(2, '0')}`;
}
