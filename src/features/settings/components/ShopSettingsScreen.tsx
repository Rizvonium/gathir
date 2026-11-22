/** /settings/shop — shop name, seller, phone, address, UPI: what customers see on catalogues and bills. */
import { useTranslation } from 'react-i18next';

import { Button, PhoneInput, TextField } from '@/ui/components';

import { useShopForm } from '../hooks/useShopForm';
import { SubScreen, goBack } from './SubScreen';

export function ShopSettingsScreen() {
  const { t } = useTranslation('settings');
  const f = useShopForm(goBack);

  return (
    <SubScreen
      testID="settings-shop"
      title={t('shop.title')}
      subtitle={t('shop.subtitle')}
      footer={<Button testID="shop-save" label={t('shop.save')} icon="check" size="lg" fullWidth onPress={f.save} />}>
      <TextField
        testID="shop-name"
        label={t('shop.shopName')}
        value={f.form.shopName}
        onChangeText={(v) => f.set('shopName', v)}
        error={f.errors.shopName ? t('shop.shopNameRequired') : undefined}
        autoCapitalize="words"
        maxLength={60}
        returnKeyType="next"
      />
      <TextField
        testID="shop-seller"
        label={t('shop.sellerName')}
        helper={t('shop.optional')}
        value={f.form.sellerName}
        onChangeText={(v) => f.set('sellerName', v)}
        autoCapitalize="words"
        maxLength={60}
      />
      <PhoneInput
        testID="shop-phone"
        label={t('shop.phone')}
        helper={t('shop.phoneHelper')}
        value={f.form.phone}
        onChange={f.setPhone}
      />
      <TextField
        testID="shop-address"
        label={t('shop.address')}
        helper={t('shop.addressHelper')}
        value={f.form.address}
        onChangeText={(v) => f.set('address', v)}
        multiline
        maxLength={200}
      />
      <TextField
        testID="shop-upi"
        label={t('shop.upi')}
        helper={t('shop.upiHelper')}
        value={f.form.upiId}
        onChangeText={(v) => f.set('upiId', v)}
        error={f.errors.upiId ? t('shop.upiInvalid') : undefined}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        maxLength={80}
      />
      <TextField
        testID="shop-code"
        label={t('shop.sellerCode')}
        helper={t('shop.sellerCodeHelper')}
        value={f.form.sellerCode}
        onChangeText={(v) => f.set('sellerCode', v)}
        autoCapitalize="characters"
        maxLength={16}
      />
    </SubScreen>
  );
}
