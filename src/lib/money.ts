/** Money is stored as integer paise. Display uses Indian digit grouping (₹1,25,000). */

const rupeeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const rupeeFormatterPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const plainFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/** "₹1,25,000" (shows paise only when not a whole rupee). */
export function formatINR(paise: number): string {
  const whole = paise % 100 === 0;
  return (whole ? rupeeFormatter : rupeeFormatterPaise).format(paise / 100);
}

/** "1,25,000" — for counts and plain numbers. */
export function formatNumber(n: number): string {
  return plainFormatter.format(n);
}

/** Parse user input like "6,500" or "6500.50" into paise. Returns null when invalid. */
export function parseRupeesInput(text: string): number | null {
  const cleaned = text.replace(/[₹,\s]/g, '');
  if (cleaned === '' || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return rupeesToPaise(Number(cleaned));
}
