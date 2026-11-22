/** Shop profile form: loads once from settings, validates, saves in one write. */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { updateSettings } from '@/db/repo/settings';
import { playHaptic, useToast } from '@/ui/components';

import { readSettingsRow } from '../settingsData';
import { trimShop, validateShop, type ShopForm, type ShopFormErrors } from '../settingsLogic';

export type ShopFormState = ShopForm & { sellerCode: string; phoneValid: boolean };

export function useShopForm(onSaved: () => void) {
  const { t } = useTranslation('settings');
  const toast = useToast();
  const [form, setForm] = useState<ShopFormState>(() => {
    const s = readSettingsRow(db);
    return {
      shopName: s?.shopName ?? '',
      sellerName: s?.sellerName ?? '',
      sellerCode: s?.sellerCode ?? '',
      phone: s?.phone ?? '',
      address: s?.address ?? '',
      upiId: s?.upiId ?? '',
      phoneValid: true,
    };
  });
  const [errors, setErrors] = useState<ShopFormErrors>({});
  const [tried, setTried] = useState(false);

  const set = <K extends keyof ShopFormState>(key: K, value: ShopFormState[K]) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (tried) setErrors(validateShop(next));
  };

  /** PhoneInput gives E.164 when valid; an unfinished number keeps the old value and blocks Save. */
  const setPhone = (e164: string | null, text: string) => {
    const empty = text.trim() === '';
    setForm({ ...form, phone: e164 ?? (empty ? '' : form.phone), phoneValid: e164 !== null || empty });
  };

  const save = () => {
    setTried(true);
    const e = validateShop(form);
    setErrors(e);
    if (Object.keys(e).length > 0 || !form.phoneValid) {
      playHaptic('error');
      return;
    }
    const clean = trimShop(form);
    try {
      updateSettings(db, { ...clean, sellerCode: form.sellerCode.trim() });
      playHaptic('success');
      toast.show({ message: t('shop.saved'), tone: 'success' });
      onSaved();
    } catch {
      toast.show({ message: t('saveFailed'), tone: 'danger' });
    }
  };

  return { form, errors, set, setPhone, save };
}
