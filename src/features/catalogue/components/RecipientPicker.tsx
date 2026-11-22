/**
 * Who gets it: one tap on a saved customer sends straight to their chat. Or type a number,
 * or let WhatsApp's own chat list decide. Used by the catalogue send step and the product card.
 */
import { FlashList } from '@shopify/flash-list';
import { useState, type ReactElement } from 'react';
import { I18nManager, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCustomers } from '@/db/hooks';
import type { CustomerListRow } from '@/db/repo/customerQueries';
import { formatPhone } from '@/lib/phone';
import { hashSeed } from '@/pdf/patterns';
import { AppText, Avatar, Button, Divider, Icon, ListRow, PhoneInput, SectionHeader, TextField } from '@/ui/components';
import { inkAt, patternInks } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

import type { Recipient } from '../logic/recipient';

export type RecipientPickerProps = {
  onPick: (recipient: Recipient) => void;
  /** Rendered above the search (e.g. the card preview). */
  header?: ReactElement;
  /** Blocks taps while a send is in progress. */
  disabled?: boolean;
};

export function RecipientPicker({ onPick, header, disabled }: RecipientPickerProps) {
  const { t } = useTranslation('catalogue');
  const { colors, space } = useTheme();
  const [query, setQuery] = useState('');
  const [numberOpen, setNumberOpen] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneText, setPhoneText] = useState('');
  const customers = useCustomers({ search: query.trim() || undefined, sort: 'recent' });
  const inks = patternInks(colors);

  const top = (
    <View style={{ gap: space.md, paddingTop: space.md, paddingBottom: space.sm }}>
      {header}
      <View style={{ gap: space.sm }}>
        {numberOpen ? (
          <View style={{ gap: space.sm }}>
            <PhoneInput
              testID="recipient-phone"
              label={t('send.numberLabel')}
              value={phone ?? ''}
              autoFocus
              onChange={(e164, text) => {
                setPhone(e164);
                setPhoneText(text);
              }}
              onSubmitEditing={() => phone && onPick({ kind: 'number', phone })}
            />
            <Button
              testID="recipient-send-number"
              label={t('send.sendToNumber')}
              icon="send"
              disabled={disabled || !phone}
              onPress={() => phone && onPick({ kind: 'number', phone })}
            />
          </View>
        ) : (
          <Button testID="recipient-type-number" label={t('send.typeNumber')} icon="dialpad" variant="secondary" onPress={() => setNumberOpen(true)} />
        )}
        <Button
          testID="recipient-chat"
          label={t('send.chooseChat')}
          icon="chat"
          variant="tonal"
          disabled={disabled}
          onPress={() => onPick({ kind: 'chat' })}
        />
      </View>
      <SectionHeader title={t('send.customersTitle')} />
      <TextField label={t('send.searchLabel')} value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" testID="recipient-search" />
    </View>
  );

  const empty = (
    <AppText muted style={{ paddingVertical: space.lg }}>
      {query.trim() ? t('send.noMatch', { query: query.trim() }) : t('send.noCustomers')}
    </AppText>
  );

  return (
    <FlashList
      data={customers}
      keyExtractor={(c) => c.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={top}
      ListEmptyComponent={empty}
      ItemSeparatorComponent={() => <Divider inset={56} />}
      contentContainerStyle={{ paddingBottom: space.xl }}
      extraData={`${disabled}-${phoneText}`}
      renderItem={({ item }) => (
        <CustomerRow customer={item} color={inkAt(inks, hashSeed(item.id))} disabled={disabled} onPick={onPick} />
      )}
    />
  );
}

function CustomerRow({ customer, color, disabled, onPick }: { customer: CustomerListRow; color: string; disabled?: boolean; onPick: (r: Recipient) => void }) {
  const { t } = useTranslation('catalogue');
  const subtitle = customer.phone ? formatPhone(customer.phone) : t('send.noPhone');
  return (
    <View style={disabled ? styles.dim : undefined} pointerEvents={disabled ? 'none' : 'auto'}>
      <ListRow
        testID={`recipient-${customer.id}`}
        title={customer.name}
        subtitle={[subtitle, customer.city].filter(Boolean).join(', ')}
        leading={<Avatar name={customer.name} color={color} />}
        chevron={false}
        trailing={<SendGlyph />}
        accessibilityLabel={`${customer.name}. ${subtitle}. ${t('send.rowHint')}`}
        onPress={() => onPick({ kind: 'customer', id: customer.id, name: customer.name, phone: customer.phone })}
      />
    </View>
  );
}

function SendGlyph() {
  const { colors, radius } = useTheme();
  return (
    <View style={[styles.glyph, { backgroundColor: colors.surfaceSunken, borderRadius: radius.pill }]}>
      <Icon name="send" size={18} tone="primary" style={styles.flip} />
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { opacity: 0.4 },
  flip: { transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] },
  glyph: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
