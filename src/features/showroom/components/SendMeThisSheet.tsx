/**
 * "Send me this": the seller finds the customer (or adds them with just a number), the shawl is
 * saved to their likes, then a photo card or a small catalogue of everything they liked goes out.
 * Saved customers appear only after typing, so a browsing customer never sees the customer book.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useCustomers } from '@/db/hooks';
import { addToCustomerCatalogue, removeFromCustomerCatalogue } from '@/db/repo/customerCatalogue';
import type { ProductListRow } from '@/db/repo/productQueries';
import { quickAddCustomer, recordLikedItems } from '@/features/catalogue/logic/record';
import { formatPhone } from '@/lib/phone';
import { AppSheet, AppText, Button, ListRow, PhoneInput, playHaptic, TextField, useToast } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { addLiked } from '../logic/showroom';

/** Matches shown at most (a short list keeps the sheet calm). */
const MAX_MATCHES = 5;
/** Characters typed before any saved name is shown. */
const MIN_QUERY = 2;

export type Chosen = { id: string; name: string; likedIds: string[] };

export type SendMeThisSheetProps = {
  product: ProductListRow | null;
  visible: boolean;
  onClose: () => void;
  /** Liked ids per customer for this Showroom session. */
  liked: Record<string, string[]>;
  onLiked: (customerId: string, ids: string[]) => void;
  onSendCard: (c: Chosen, productId: string) => void;
  onSendMini: (c: Chosen) => void;
};

export function SendMeThisSheet({ product, visible, onClose, liked, onLiked, onSendCard, onSendMini }: SendMeThisSheetProps) {
  const { t } = useTranslation('showroom');
  const { space } = useTheme();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Chosen | null>(null);
  /** Catalogue item id once this shawl is saved to the chosen customer's catalogue. */
  const [savedItem, setSavedItem] = useState<string | null>(null);
  const q = query.trim();
  const matches = useCustomers({ search: q || undefined, sort: 'recent' }).slice(0, MAX_MATCHES);

  const reset = () => {
    setQuery('');
    setAdding(false);
    setName('');
    setPhone(null);
    setChosen(null);
    setSavedItem(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const choose = (id: string, customerName: string) => {
    if (!product) return;
    try {
      recordLikedItems(db, id, [product.id]);
    } catch {
      toast.show({ message: t('sheet.saveFailed'), tone: 'danger' });
    }
    const ids = addLiked(liked[id] ?? [], product.id);
    onLiked(id, ids);
    setChosen({ id, name: customerName, likedIds: ids });
  };

  /** "Save to <name>'s catalogue": the seller's shortlist for this customer (Undo from the toast). */
  const saveToCatalogue = () => {
    if (!chosen || !product) return;
    let itemId: string;
    try {
      itemId = addToCustomerCatalogue(db, { customerId: chosen.id, productId: product.id });
    } catch {
      toast.show({ message: t('sheet.saveFailed'), tone: 'danger' });
      return;
    }
    playHaptic('success');
    setSavedItem(itemId);
    toast.show({
      message: t('sheet.savedToCatalogue', { name: chosen.name }),
      tone: 'success',
      actionLabel: t('common:actions.undo'),
      onAction: () => {
        try {
          removeFromCustomerCatalogue(db, itemId);
        } catch {
          // Already removed.
        }
        setSavedItem(null);
      },
    });
  };

  const addAndChoose = () => {
    if (!phone) return;
    try {
      const c = quickAddCustomer(db, { name, phone });
      choose(c.id, c.name);
    } catch {
      toast.show({ message: t('sheet.saveFailed'), tone: 'danger' });
    }
  };

  return (
    <AppSheet visible={visible} onClose={close} title={chosen ? t('sheet.whatTitle', { name: chosen.name }) : t('sheet.whoTitle')} testID="send-me-this-sheet">
      {chosen && product ? (
        <View style={{ gap: space.sm }}>
          <AppText muted>{t('sheet.saved', { name: chosen.name })}</AppText>
          <Button
            testID="sheet-send-card"
            label={t('sheet.card')}
            icon="image"
            size="lg"
            fullWidth
            onPress={() => {
              const c = chosen;
              close();
              onSendCard(c, product.id);
            }}
          />
          <Button
            testID="sheet-send-mini"
            label={t('sheet.mini', { count: chosen.likedIds.length })}
            icon="picture-as-pdf"
            variant="secondary"
            size="lg"
            fullWidth
            onPress={() => {
              const c = chosen;
              close();
              onSendMini(c);
            }}
          />
          <Button
            testID="sheet-save-catalogue"
            label={savedItem ? t('sheet.inCatalogue', { name: chosen.name }) : t('sheet.saveToCatalogue', { name: chosen.name })}
            icon={savedItem ? 'check' : 'bookmark-add'}
            variant="ghost"
            size="lg"
            fullWidth
            disabled={!!savedItem}
            onPress={saveToCatalogue}
          />
        </View>
      ) : adding ? (
        <View style={{ gap: space.md }}>
          <PhoneInput testID="sheet-phone" label={t('sheet.phoneLabel')} value={phone ?? ''} autoFocus onChange={(e164) => setPhone(e164)} />
          <TextField label={t('sheet.nameLabel')} value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="done" />
          <View style={[styles.row, { gap: space.sm }]}>
            <Button label={t('sheet.back')} variant="ghost" onPress={() => setAdding(false)} />
            <Button testID="sheet-add" label={t('sheet.continue')} icon="arrow-forward" style={styles.flex} disabled={!phone} onPress={addAndChoose} />
          </View>
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <TextField testID="sheet-search" label={t('sheet.search')} value={query} onChangeText={setQuery} autoCorrect={false} helper={t('sheet.searchHelper')} />
          {q.length >= MIN_QUERY
            ? matches.map((c) => (
                <ListRow
                  key={c.id}
                  testID={`sheet-customer-${c.id}`}
                  title={c.name}
                  subtitle={c.phone ? formatPhone(c.phone) : undefined}
                  chevron={false}
                  onPress={() => choose(c.id, c.name)}
                />
              ))
            : null}
          {q.length >= MIN_QUERY && matches.length === 0 ? <AppText muted>{t('sheet.noMatch', { query: q })}</AppText> : null}
          <Button testID="sheet-new" label={t('sheet.newCustomer')} icon="person-add" variant="tonal" fullWidth onPress={() => setAdding(true)} />
        </View>
      )}
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
});
