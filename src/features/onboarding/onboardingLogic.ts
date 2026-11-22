/** Pure first-launch logic: step order, form validation and settings patches. No React, no DB. */

/** Route paths of the onboarding steps after Welcome, in order (group `(onboarding)`). */
export const ONBOARDING_STEPS = ['/language', '/shop', '/owner', '/app-lock', '/start'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Zero-based position for ProgressDots. */
export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}

/** The step after `step`, or null after the last one. */
export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const i = stepIndex(step);
  return i >= 0 && i < ONBOARDING_STEPS.length - 1 ? ONBOARDING_STEPS[i + 1] : null;
}

/** Light UPI VPA check: "name@handle". Empty is allowed (field is optional). */
export function isValidUpiId(raw: string): boolean {
  const v = raw.trim();
  if (v === '') return true;
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/.test(v);
}

export type ShopForm = {
  shopName: string;
  sellerName: string;
  /** Raw text in the phone field. */
  phoneText: string;
  /** E.164 when the phone text is a valid number, else null. */
  phoneE164: string | null;
  address: string;
  upiId: string;
};

export type ShopFormErrors = Partial<Record<'shopName' | 'phone' | 'upiId', 'required' | 'invalid'>>;

/** Shop name is required; phone and UPI must be valid when typed. */
export function validateShopForm(form: ShopForm): ShopFormErrors {
  const errors: ShopFormErrors = {};
  if (form.shopName.trim() === '') errors.shopName = 'required';
  if (form.phoneText.trim() !== '' && !form.phoneE164) errors.phone = 'invalid';
  if (!isValidUpiId(form.upiId)) errors.upiId = 'invalid';
  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

/** Trimmed settings patch for the shop step. Collapses runs of spaces in names. */
export function shopPatch(form: ShopForm): {
  shopName: string;
  sellerName: string;
  phone: string;
  address: string;
  upiId: string;
} {
  const clean = (s: string) => s.trim().replace(/[ \t]+/g, ' ');
  return {
    shopName: clean(form.shopName),
    sellerName: clean(form.sellerName),
    phone: form.phoneText.trim() === '' ? '' : (form.phoneE164 ?? ''),
    address: form.address
      .split('\n')
      .map((l) => clean(l))
      .filter(Boolean)
      .join('\n'),
    upiId: form.upiId.trim().toLowerCase(),
  };
}

/** Owner number to store: '' when left empty, null when typed but invalid (block Continue). */
export function ownerNumberToSave(text: string, e164: string | null): string | null {
  if (text.trim() === '') return '';
  return e164;
}
