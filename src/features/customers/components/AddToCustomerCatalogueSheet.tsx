/**
 * "Add to a customer's catalogue" (PLAN §3: from product detail). Pick a customer; the design is
 * added at the end of their personal catalogue, with Undo. Customers who already have it are marked.
 * Mount on a seller-only screen (product detail): it shows the customer book. Someone not saved
 * yet (an empty book, or no match) is added right here (name and number) with the design in one go.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useCustomers, useDbQuery } from '@/db/hooks';
import { addToCustomerCatalogue, removeFromCustomerCatalogue } from '@/db/repo/customerCatalogue';
import { createCustomer } from '@/db/repo/customerWrites';
import { DuplicateCustomerError } from '@/db/repo/errors';
import { customerCatalogueItems } from '@/db/schema';
import { formatPhone, toE164 } from '@/lib/phone';
import { AppSheet, AppText, Button, Icon, ListRow, PhoneInput, playHaptic, TextField, useToast } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { customerHref } from '../logic/links';

/** Customers listed at most (recent first; search narrows it). */
const MAX_ROWS = 8;

export type AddToCustomerCatalogueSheetProps = {
  productId: string;
  visible: boolean;
  onClose: () => void;
};

/** Ids of customers whose personal catalogue holds this design. `enabled: false` stops re-reading it. */
export function useCustomersWithDesign(productId: string, enabled = true): Set<string> {
  const ids = useDbQuery(
    (d) =>
      d
        .select({ customerId: customerCatalogueItems.customerId })
        .from(customerCatalogueItems)
        .where(and(eq(customerCatalogueItems.productId, productId), isNull(customerCatalogueItems.removedAt)))
        .all()
        .map((r) => r.customerId)
        .join(','),
    [productId],
    { tables: ['customer_catalogue_items'], enabled },
  );
  return new Set(ids ? ids.split(',') : []);
}

export function AddToCustomerCatalogueSheet({ productId, visible, onClose }: AddToCustomerCatalogueSheetProps) {
  const { t } = useTranslation('customers');
  const { space } = useTheme();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const q = query.trim();
  // The sheet stays mounted under product detail: while it is closed, its queries don't re-run
  // on every stock write (they catch up when it opens).
  const customers = useCustomers({ search: q || undefined, sort: 'recent' }, { enabled: visible }).slice(0, MAX_ROWS);
  const having = useCustomersWithDesign(productId, visible);
  // "+ New customer": name and number inline, then the design is added to them.
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState<string | null>(null);

  const close = () => {
    setQuery('');
    setAdding(false);
    setNewName('');
    setNewPhone(null);
    onClose();
  };

  const startAdding = () => {
    // What was typed in the search is most likely their name (or their number).
    if (q && /\d/.test(q) && !/[a-z]/i.test(q)) setNewPhone(toE164(q));
    else setNewName(q);
    setAdding(true);
  };

  const addNew = () => {
    const name = newName.trim();
    if (!name) return;
    let customerId: string;
    let savedName = name;
    try {
      customerId = createCustomer(db, { name, phone: newPhone });
    } catch (e) {
      if (!(e instanceof DuplicateCustomerError)) {
        playHaptic('error');
        toast.show({ message: t('theirCatalogue.failed'), tone: 'danger' });
        return;
      }
      // That number is already saved: add the design to them.
      customerId = e.existingId;
      savedName = e.existingName;
    }
    add(customerId, savedName);
  };

  const add = (customerId: string, name: string) => {
    if (having.has(customerId)) {
      close();
      router.push(customerHref(customerId));
      return;
    }
    let itemId: string;
    try {
      itemId = addToCustomerCatalogue(db, { customerId, productId });
    } catch {
      playHaptic('error');
      toast.show({ message: t('theirCatalogue.failed'), tone: 'danger' });
      return;
    }
    playHaptic('success');
    close();
    toast.show({
      message: t('theirCatalogue.addedOne', { name }),
      tone: 'success',
      secondaryActionLabel: t('theirCatalogue.open'),
      onSecondaryAction: () => router.push(customerHref(customerId)),
      actionLabel: t('common:actions.undo'),
      onAction: () => {
        try {
          removeFromCustomerCatalogue(db, itemId);
        } catch {
          // Already gone: nothing to undo.
        }
      },
    });
  };

  return (
    <AppSheet visible={visible} onClose={close} title={t('theirCatalogue.pickCustomer')} snapPoints={['half', 'full']} testID="add-to-customer-catalogue">
      <View style={{ gap: space.sm }}>
        {adding ? (
          <View style={{ gap: space.md }}>
            <TextField testID="add-to-catalogue-new-name" label={t('form.name')} value={newName} onChangeText={setNewName} autoFocus={!newName} autoCapitalize="words" />
            <PhoneInput
              testID="add-to-catalogue-new-phone"
              label={t('form.phone')}
              value={newPhone ?? ''}
              onChange={(e164) => setNewPhone(e164)}
            />
            <Button testID="add-to-catalogue-new-save" label={t('theirCatalogue.addNewAndSave')} icon="playlist-add" size="lg" fullWidth disabled={!newName.trim()} onPress={addNew} />
            <Button label={t('common:actions.back')} variant="ghost" fullWidth onPress={() => setAdding(false)} />
          </View>
        ) : (
          <>
            <TextField testID="add-to-catalogue-search" label={t('list.search')} value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" />
            {customers.length === 0 ? (
              <AppText muted>{q ? t('empty.noMatchSearch', { query: q }) : t('empty.title')}</AppText>
            ) : (
              customers.map((c) => {
                const has = having.has(c.id);
                const subtitle = [c.phone ? formatPhone(c.phone) : null, c.city || null, has ? t('theirCatalogue.alreadyIn') : null].filter(Boolean).join(' · ');
                return (
                  <ListRow
                    key={c.id}
                    testID={`add-to-catalogue-${c.id}`}
                    title={c.name}
                    subtitle={subtitle || undefined}
                    chevron={false}
                    style={styles.row}
                    trailing={<Icon name={has ? 'check-circle' : 'playlist-add'} tone={has ? 'meadow' : 'primary'} />}
                    accessibilityLabel={has ? `${c.name}. ${t('theirCatalogue.alreadyIn')}. ${t('theirCatalogue.open')}` : t('theirCatalogue.addTo', { name: c.name })}
                    onPress={() => add(c.id, c.name)}
                  />
                );
              })
            )}
            <Button
              testID="add-to-catalogue-new"
              label={q && customers.length === 0 && !/\d/.test(q) ? t('empty.addNamed', { query: q }) : t('theirCatalogue.newCustomer')}
              icon="person-add"
              variant={customers.length === 0 ? 'primary' : 'tonal'}
              fullWidth
              onPress={startAdding}
            />
          </>
        )}
      </View>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 0 },
});
