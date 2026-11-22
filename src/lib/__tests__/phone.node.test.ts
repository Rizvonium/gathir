import {
  callingCodePrefix,
  formatPhone,
  formatPhoneAsYouType,
  formatPhoneInternational,
  isValidPhone,
  nationalDigits,
  toE164,
  toWhatsAppNumber,
} from '../phone';

describe('phone', () => {
  it('normalises Indian numbers to E.164', () => {
    expect(toE164('9876543210')).toBe('+919876543210');
    expect(toE164('98765 43210')).toBe('+919876543210');
    expect(toE164('09876543210')).toBe('+919876543210');
    expect(toE164('+91 98765-43210')).toBe('+919876543210');
    expect(toE164('0091 9876543210')).toBe('+919876543210');
  });

  it('keeps foreign numbers typed with +', () => {
    expect(toE164('+44 7400 123456')).toBe('+447400123456');
  });

  it('rejects incomplete or empty input', () => {
    expect(toE164('')).toBeNull();
    expect(toE164('12345')).toBeNull();
    expect(isValidPhone('98765')).toBe(false);
    expect(isValidPhone('9876543210')).toBe(true);
  });

  it('formats for display', () => {
    expect(formatPhone('+919876543210')).toBe('98765 43210');
    expect(formatPhone('+447400123456')).toBe('+44 7400 123456');
    expect(formatPhoneInternational('+919876543210')).toBe('+91 98765 43210');
    expect(formatPhone('not a phone')).toBe('not a phone');
  });

  it('formats as you type', () => {
    expect(formatPhoneAsYouType('98765')).toBe('98765');
    expect(formatPhoneAsYouType('9876543210')).toBe('98765 43210');
  });

  it('builds WhatsApp numbers and national digits', () => {
    expect(toWhatsAppNumber('98765 43210')).toBe('919876543210');
    expect(toWhatsAppNumber('123')).toBeNull();
    expect(nationalDigits('+919876543210')).toBe('9876543210');
    expect(callingCodePrefix()).toBe('+91');
  });
});
