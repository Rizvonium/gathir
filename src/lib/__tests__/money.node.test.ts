import { formatINR, parseRupeesInput, rupeesToPaise } from '@/lib/money';

describe('money', () => {
  it('formats with Indian grouping', () => {
    expect(formatINR(rupeesToPaise(125000))).toBe('₹1,25,000');
    expect(formatINR(650000)).toBe('₹6,500');
    expect(formatINR(650050)).toBe('₹6,500.50');
  });
  it('parses seller input', () => {
    expect(parseRupeesInput('6,500')).toBe(650000);
    expect(parseRupeesInput('₹ 1,25,000')).toBe(12500000);
    expect(parseRupeesInput('12.5')).toBe(1250);
    expect(parseRupeesInput('abc')).toBeNull();
    expect(parseRupeesInput('')).toBeNull();
  });
});
