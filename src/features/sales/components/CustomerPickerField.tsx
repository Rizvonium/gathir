/**
 * Customer field for the Sell sheet (reusable): Walk-in by default, search saved customers,
 * or add a new one inline (name + phone, or pick from phone contacts) without leaving the
 * sheet. A phone number that is already saved switches to that customer (no duplicates).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatPhone, toE164 } from '@/lib/phone';
import { AppText, Avatar, Button, Chip, IconButton, ListRow, PhoneInput, TextField } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { useCustomerPicker } from '../hooks/useCustomerPicker';
import { pickContact } from '../logic/pickContact';
import type { CustomerChoice } from '../logic/sellCart';

export type CustomerPickerFieldProps = {
  value: CustomerChoice;
  onChange: (next: CustomerChoice) => void;
  /** Shown under the name field when a new customer has no name yet. */
  nameError?: string;
  testID?: string;
};

const looksLikePhone = (q: string) => /^[+\d][\d\s-]{3,}$/.test(q.trim());

export function CustomerPickerField({ value, onChange, nameError, testID = 'customer-picker' }: CustomerPickerFieldProps) {
  const { colors, space, radius } = useTheme();
  const { t } = useTranslation('sales');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const { results, findSavedByPhone } = useCustomerPicker(searching ? query : '');

  const selectExisting = (c: { id: string; name: string; phone: string | null }, dup = false) => {
    setSearching(false);
    setQuery('');
    setNotice(dup ? t('customer.alreadySaved', { name: c.name }) : null);
    onChange({ kind: 'existing', id: c.id, name: c.name, phone: c.phone });
  };

  const startNew = (prefill = '') => {
    setSearching(false);
    setNotice(null);
    const isPhone = looksLikePhone(prefill);
    onChange({ kind: 'new', name: isPhone ? '' : prefill.trim(), phone: isPhone ? toE164(prefill) : null });
  };

  const toWalkIn = () => {
    setSearching(false);
    setQuery('');
    setNotice(null);
    onChange({ kind: 'walk_in' });
  };

  const onPhone = (e164: string | null) => {
    if (value.kind !== 'new') return;
    const saved = e164 ? findSavedByPhone(e164) : null;
    if (saved) {
      selectExisting(saved, true);
      return;
    }
    onChange({ ...value, phone: e164 });
  };

  const fromContacts = async () => {
    const picked = await pickContact();
    if (picked.status === 'cancelled') return;
    if (picked.status !== 'ok') {
      setNotice(t(picked.status === 'denied' ? 'customer.contactsDenied' : 'customer.contactsFailed'));
      return;
    }
    const saved = picked.phone ? findSavedByPhone(picked.phone) : null;
    if (saved) {
      selectExisting(saved, true);
      return;
    }
    setNotice(picked.phone ? null : t('customer.contactNoPhone'));
    onChange({ kind: 'new', name: picked.name, phone: picked.phone });
  };

  const header = (
    <AppText variant="title" accessibilityRole="header">
      {t('customer.label')}
    </AppText>
  );

  if (value.kind === 'existing') {
    return (
      <View testID={testID} style={{ gap: space.sm }}>
        {header}
        <View style={[styles.selected, { backgroundColor: colors.surfaceSunken, borderRadius: radius.md, paddingStart: space.md, gap: space.md }]}>
          <Avatar name={value.name} color={colors.teal} />
          <View style={styles.flex} accessible accessibilityLabel={t('customer.selected', { name: value.name })}>
            <AppText weight="semibold" numberOfLines={1}>
              {value.name}
            </AppText>
            {value.phone ? (
              <AppText variant="small" muted numeric>
                {formatPhone(value.phone)}
              </AppText>
            ) : null}
          </View>
          <IconButton icon="close" accessibilityLabel={t('customer.remove')} onPress={toWalkIn} testID={`${testID}-remove`} />
        </View>
        {notice ? (
          <AppText variant="small" tone="teal" testID={`${testID}-notice`}>
            {notice}
          </AppText>
        ) : null}
      </View>
    );
  }

  if (value.kind === 'new') {
    return (
      <View testID={testID} style={{ gap: space.md }}>
        <View style={styles.headerRow}>
          <AppText variant="title" accessibilityRole="header" style={styles.flex}>
            {t('customer.newTitle')}
          </AppText>
          <Button label={t('customer.useWalkIn')} variant="ghost" size="sm" onPress={toWalkIn} testID={`${testID}-walkin`} />
        </View>
        <TextField
          testID={`${testID}-name`}
          label={t('customer.name')}
          value={value.name}
          onChangeText={(name) => onChange({ ...value, name })}
          autoCapitalize="words"
          autoComplete="name"
          autoFocus={!value.name}
          error={nameError}
        />
        <PhoneInput
          testID={`${testID}-phone`}
          label={t('customer.phone')}
          helper={t('customer.phoneHelper')}
          value={value.phone ?? ''}
          onChange={onPhone}
        />
        <Button label={t('customer.fromContacts')} icon="contacts" variant="secondary" onPress={() => void fromContacts()} testID={`${testID}-contacts`} />
        {notice ? (
          <AppText variant="small" muted testID={`${testID}-notice`}>
            {notice}
          </AppText>
        ) : null}
      </View>
    );
  }

  return (
    <View testID={testID} style={{ gap: space.sm }}>
      {header}
      <View style={[styles.chips, { gap: space.sm }]}>
        <Chip label={t('walkIn')} icon="storefront" role="radio" selected={!searching} onPress={toWalkIn} testID={`${testID}-walkin`} />
        <Chip label={t('customer.change')} icon="search" role="radio" selected={searching} onPress={() => setSearching(true)} testID={`${testID}-search`} />
        <Chip label={t('customer.new')} icon="person-add" onPress={() => startNew()} testID={`${testID}-new`} />
      </View>
      {!searching ? (
        <AppText variant="small" muted>
          {t('customer.walkInHint')}
        </AppText>
      ) : (
        <View style={{ gap: space.xs }}>
          <TextField
            testID={`${testID}-query`}
            label={t('customer.search')}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
          />
          {results.map((c) => (
            <ListRow
              key={c.id}
              testID={`${testID}-result-${c.id}`}
              title={c.name}
              subtitle={c.phone ? formatPhone(c.phone) : undefined}
              leading={<Avatar name={c.name} color={colors.teal} />}
              chevron={false}
              accessibilityLabel={t('customer.pick', { name: c.name })}
              onPress={() => selectExisting({ id: c.id, name: c.name, phone: c.phone })}
              style={{ paddingHorizontal: 0 }}
            />
          ))}
          {results.length === 0 && query.trim() ? (
            <AppText variant="small" muted>
              {t('customer.noMatch')}
            </AppText>
          ) : null}
          <Button
            label={t('customer.new')}
            icon="person-add"
            variant="ghost"
            onPress={() => startNew(query)}
            testID={`${testID}-new-from-search`}
            style={styles.start}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  selected: { flexDirection: 'row', alignItems: 'center', minHeight: 64 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  start: { alignSelf: 'flex-start' },
});
