/**
 * "Add to a customer's catalogue" (PLAN §3: from product detail). Pick a customer; the design is
 * added at the end of their personal catalogue, with Undo. Customers who already have it are marked.
 * Mount on a seller-only screen (product detail): it shows the customer book.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useCustomers, useDbQuery } from '@/db/hooks';
import { addToCustomerCatalogue, removeFromCustomerCatalogue } from '@/db/repo/customerCatalogue';
import { customerCatalogueItems } from '@/db/schema';
import { formatPhone } from '@/lib/phone';
import { AppSheet, AppText, Icon, ListRow, playHaptic, TextField, useToast } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { customerHref } from '../logic/links';

/** Customers listed at most (recent first; search narrows it). */
const MAX_ROWS = 8;

export type AddToCustomerCatalogueSheetProps = {
  productId: string;
  visible: boolean;
  onClose: () => void;
};

/** Ids of customers whose personal catalogue holds this design. */
export function useCustomersWithDesign(productId: string): Set<string> {
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
  );
  return new Set(ids ? ids.split(',') : []);
}

export function AddToCustomerCatalogueSheet({ productId, visible, onClose }: AddToCustomerCatalogueSheetProps) {
  const { t } = useTranslation('customers');
  const { space } = useTheme();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const q = query.trim();
  const customers = useCustomers({ search: q || undefined, sort: 'recent' }).slice(0, MAX_ROWS);
  const having = useCustomersWithDesign(productId);

  const close = () => {
    setQuery('');
    onClose();
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
      </View>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 0 },
});
