import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import type { TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { Button, PhoneInput, playHaptic, TextField, useToast } from '@/ui/components';

import { OnboardingScaffold } from './OnboardingScaffold';
import { readOnboardingDraft, saveShop } from './onboardingData';
import { hasErrors, shopPatch, validateShopForm, type ShopForm, type ShopFormErrors } from './onboardingLogic';

type InputRef = ComponentRef<typeof TextInput>;

/** Step 2: the shop's details for PDFs and bills. Only the shop name is required. */
export function ShopScreen() {
  const { t } = useTranslation('onboarding');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<ShopForm>(() => {
    const d = readOnboardingDraft(db);
    return { shopName: d.shopName, sellerName: d.sellerName, phoneText: d.phone, phoneE164: d.phone || null, address: d.address, upiId: d.upiId };
  });
  const [errors, setErrors] = useState<ShopFormErrors>({});
  const [tried, setTried] = useState(false);

  const shopRef = useRef<InputRef>(null);
  const sellerRef = useRef<InputRef>(null);
  const phoneRef = useRef<InputRef>(null);
  const addressRef = useRef<InputRef>(null);
  const upiRef = useRef<InputRef>(null);

  const update = (patch: Partial<ShopForm>) => {
    const next = { ...form, ...patch };
    setForm(next);
    // After a failed Continue, errors clear as soon as the seller fixes them.
    if (tried) setErrors(validateShopForm(next));
  };

  const next = () => {
    const found = validateShopForm(form);
    setTried(true);
    setErrors(found);
    if (hasErrors(found)) {
      playHaptic('error');
      if (found.shopName) shopRef.current?.focus();
      else if (found.phone) phoneRef.current?.focus();
      else upiRef.current?.focus();
      return;
    }
    try {
      saveShop(db, shopPatch(form));
      router.push('/owner');
    } catch {
      toast.show({ message: tc('errors.generic'), tone: 'danger' });
    }
  };

  return (
    <OnboardingScaffold
      testID="onboarding-shop"
      step="/shop"
      title={t('shop.title')}
      body={t('shop.body')}
      footer={<Button testID="shop-continue" label={t('continue')} size="lg" fullWidth onPress={next} />}>
      <TextField
        ref={shopRef}
        testID="shop-name"
        label={t('shop.shopName')}
        placeholder={t('shop.shopNamePlaceholder')}
        value={form.shopName}
        onChangeText={(shopName) => update({ shopName })}
        error={errors.shopName ? t('shop.shopNameRequired') : undefined}
        autoCapitalize="words"
        autoComplete="organization"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => sellerRef.current?.focus()}
        maxLength={80}
      />
      <TextField
        ref={sellerRef}
        testID="seller-name"
        label={t('shop.sellerName')}
        helper={t('shop.sellerNameHelper')}
        value={form.sellerName}
        onChangeText={(sellerName) => update({ sellerName })}
        autoCapitalize="words"
        autoComplete="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => phoneRef.current?.focus()}
        maxLength={60}
      />
      <PhoneInput
        ref={phoneRef}
        testID="shop-phone"
        label={t('shop.phone')}
        helper={t('shop.phoneHelper')}
        value={form.phoneE164 ?? ''}
        error={errors.phone ? t('shop.phoneInvalid') : undefined}
        onChange={(phoneE164, phoneText) => update({ phoneE164, phoneText })}
        onSubmitEditing={() => addressRef.current?.focus()}
      />
      <TextField
        ref={addressRef}
        testID="shop-address"
        label={t('shop.address')}
        helper={t('shop.addressHelper')}
        value={form.address}
        onChangeText={(address) => update({ address })}
        autoCapitalize="words"
        autoComplete="street-address"
        multiline
        maxLength={200}
      />
      <TextField
        ref={upiRef}
        testID="shop-upi"
        label={t('shop.upi')}
        helper={t('shop.upiHelper')}
        placeholder={t('shop.upiPlaceholder')}
        value={form.upiId}
        onChangeText={(upiId) => update({ upiId })}
        error={errors.upiId ? t('shop.upiInvalid') : undefined}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        returnKeyType="done"
        onSubmitEditing={next}
        maxLength={100}
      />
    </OnboardingScaffold>
  );
}
