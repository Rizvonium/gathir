import {
  hasErrors,
  isValidUpiId,
  nextStep,
  ONBOARDING_STEPS,
  ownerNumberToSave,
  shopPatch,
  stepIndex,
  validateShopForm,
  type ShopForm,
} from '../onboardingLogic';

const form = (over: Partial<ShopForm> = {}): ShopForm => ({
  shopName: 'Valley Pashmina',
  sellerName: '',
  phoneText: '',
  phoneE164: null,
  address: '',
  upiId: '',
  ...over,
});

describe('steps', () => {
  it('orders the five steps after welcome', () => {
    expect(ONBOARDING_STEPS).toEqual(['/language', '/shop', '/owner', '/app-lock', '/start']);
    expect(stepIndex('/shop')).toBe(1);
    expect(nextStep('/language')).toBe('/shop');
    expect(nextStep('/app-lock')).toBe('/start');
    expect(nextStep('/start')).toBeNull();
  });
});

describe('isValidUpiId', () => {
  it.each(['', 'ali@okaxis', 'ali.shah-1@ybl', '9876543210@paytm'])('accepts %p', (v) => expect(isValidUpiId(v)).toBe(true));
  it.each(['ali', '@okaxis', 'ali@', 'ali shah@ybl', 'a@1bank'])('rejects %p', (v) => expect(isValidUpiId(v)).toBe(false));
});

describe('validateShopForm', () => {
  it('requires a shop name', () => {
    expect(validateShopForm(form({ shopName: '   ' }))).toEqual({ shopName: 'required' });
  });
  it('flags a typed but invalid phone and UPI', () => {
    const errors = validateShopForm(form({ phoneText: '12', phoneE164: null, upiId: 'nope' }));
    expect(errors).toEqual({ phone: 'invalid', upiId: 'invalid' });
    expect(hasErrors(errors)).toBe(true);
  });
  it('passes with only a shop name', () => {
    expect(hasErrors(validateShopForm(form()))).toBe(false);
  });
});

describe('shopPatch', () => {
  it('trims, collapses spaces and drops empty address lines', () => {
    expect(
      shopPatch(form({ shopName: '  Valley   Pashmina ', sellerName: ' Ali ', phoneText: '98765 43210', phoneE164: '+919876543210', address: ' Lal Chowk \n\n Srinagar ', upiId: ' Ali@OKAXIS ' })),
    ).toEqual({ shopName: 'Valley Pashmina', sellerName: 'Ali', phone: '+919876543210', address: 'Lal Chowk\nSrinagar', upiId: 'ali@okaxis' });
  });
  it('stores an empty phone when the field is empty', () => {
    expect(shopPatch(form()).phone).toBe('');
  });
});

describe('ownerNumberToSave', () => {
  it('allows empty, keeps valid, blocks invalid', () => {
    expect(ownerNumberToSave('  ', null)).toBe('');
    expect(ownerNumberToSave('98765 43210', '+919876543210')).toBe('+919876543210');
    expect(ownerNumberToSave('987', null)).toBeNull();
  });
});
