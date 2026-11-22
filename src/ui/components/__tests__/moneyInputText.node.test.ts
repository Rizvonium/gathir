import { formatMoneyTyping, groupIndian, paiseToInputText } from '../moneyInputText';

describe('moneyInputText', () => {
  it('groups digits the Indian way', () => {
    expect(groupIndian('')).toBe('');
    expect(groupIndian('999')).toBe('999');
    expect(groupIndian('1000')).toBe('1,000');
    expect(groupIndian('125000')).toBe('1,25,000');
    expect(groupIndian('12345678')).toBe('1,23,45,678');
  });

  it('cleans and regroups typed text', () => {
    expect(formatMoneyTyping('1,25,0000')).toBe('12,50,000');
    expect(formatMoneyTyping('0065')).toBe('65');
    expect(formatMoneyTyping('.5')).toBe('0.5');
    expect(formatMoneyTyping('12.3.4')).toBe('12.34');
    expect(formatMoneyTyping('₹ 6,500')).toBe('6,500');
    expect(formatMoneyTyping('6500.')).toBe('6,500.');
  });

  it('turns paise into editable text', () => {
    expect(paiseToInputText(null)).toBe('');
    expect(paiseToInputText(0)).toBe('0');
    expect(paiseToInputText(650_000)).toBe('6,500');
    expect(paiseToInputText(650_050)).toBe('6,500.50');
    expect(paiseToInputText(5)).toBe('0.05');
  });
});
