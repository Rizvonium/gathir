import { Host, Switch } from '@expo/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, ChipGroup, EmptyState, IconButton, PhoneInput, Screen, TextField } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { useCustomerForm, type FormParams } from '../hooks/useCustomerForm';
import { TAG_ORDER } from '../logic/customerLogic';
import { LikesEditor } from './LikesEditor';

const close = () => (router.canGoBack() ? router.back() : router.replace('/customers'));

/**
 * Add / edit customer (PLAN §4.8). The fast path is contacts → Save, or name + phone → Save
 * (under 20 s). Likes, address and notes sit behind "More details" when adding.
 */
export function CustomerFormScreen(params: FormParams) {
  const { space, colors, radius } = useTheme();
  const { t } = useTranslation('customers');
  const f = useCustomerForm(params);
  const [more, setMore] = useState(f.editing);
  const d = f.draft;

  const closeButton = <IconButton icon="close" accessibilityLabel={t('form.close')} onPress={close} testID="customer-form-close" />;

  if (f.missing) {
    return (
      <Screen leading={closeButton}>
        <EmptyState title={t('profile.notFoundTitle')} body={t('profile.notFoundBody')} actionLabel={t('profile.back')} actionIcon="arrow-back" onAction={close} />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      title={f.editing ? t('form.editTitle') : t('form.newTitle')}
      leading={closeButton}
      footer={
        <Button
          testID="customer-save"
          label={f.editing ? t('form.saveChanges') : t('form.save')}
          icon="check"
          size="lg"
          fullWidth
          loading={f.saving}
          onPress={f.save}
        />
      }>
      <Button testID="customer-from-contacts" label={t('form.fromContacts')} icon="contacts" variant="tonal" onPress={() => void f.fromContacts()} />

      <TextField
        testID="customer-name"
        label={t('form.name')}
        value={d.name}
        onChangeText={(name) => f.update({ name })}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        autoFocus={!f.editing && !d.name}
        returnKeyType="next"
        error={f.errors.name ? t('form.nameRequired') : undefined}
      />

      <View style={{ gap: space.xs }}>
        <PhoneInput
          testID="customer-phone"
          label={t('form.phone')}
          helper={t('form.phoneHelp')}
          value={d.phone}
          onChange={f.setPhone}
          error={f.duplicate ? t('form.duplicate', { name: f.duplicate.name }) : undefined}
        />
        {f.duplicate ? (
          <Button
            testID="customer-open-duplicate"
            label={f.returning ? t('form.useExisting', { name: f.duplicate.name }) : t('form.openExisting', { name: f.duplicate.name })}
            icon={f.returning ? 'check' : 'open-in-new'}
            variant="ghost"
            onPress={f.openDuplicate}
            style={styles.start}
          />
        ) : null}
      </View>

      <View style={{ gap: space.sm }}>
        <AppText weight="semibold">{t('form.tag')}</AppText>
        <ChipGroup
          testID="customer-tag"
          mode="single"
          accessibilityLabel={t('form.tag')}
          options={TAG_ORDER.map((tag) => ({ value: tag, label: t(`tags.${tag}`) }))}
          value={d.tag}
          onChange={(tag) => f.update({ tag })}
        />
      </View>

      <TextField
        testID="customer-city"
        label={t('form.city')}
        placeholder={t('form.cityPlaceholder')}
        value={d.city}
        onChangeText={(city) => f.update({ city })}
        autoCapitalize="words"
      />

      <View style={[styles.switchRow, { gap: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.flex}>
          <AppText weight="semibold">{t('form.consent')}</AppText>
          <AppText variant="small" muted>
            {t('form.consentHelp')}
          </AppText>
        </View>
        <Host matchContents>
          <Switch testID="customer-consent" value={d.whatsappOk} onValueChange={(whatsappOk) => f.update({ whatsappOk })} />
        </Host>
      </View>

      {more ? (
        <>
          <View style={{ gap: space.sm }}>
            <AppText variant="title">{t('form.likes')}</AppText>
            <LikesEditor testID="customer-likes" likes={d.likes} onChange={(likes) => f.update({ likes })} />
          </View>
          <TextField testID="customer-address" label={t('form.address')} value={d.address} onChangeText={(address) => f.update({ address })} multiline autoCapitalize="words" />
          <TextField
            testID="customer-notes"
            label={t('form.notes')}
            placeholder={t('form.notesPlaceholder')}
            value={d.notes}
            onChangeText={(notes) => f.update({ notes })}
            multiline
            autoCapitalize="sentences"
          />
        </>
      ) : (
        <Button testID="customer-more" label={t('form.more')} icon="expand-more" variant="ghost" onPress={() => setMore(true)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  start: { alignSelf: 'flex-start' },
  switchRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
});
