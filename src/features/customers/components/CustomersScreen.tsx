import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CustomerListRow } from '@/db/repo/customerQueries';
import { Button, EmptyState, Screen, useToast } from '@/ui/components';
import { LoomEmptyState } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

import { useContactActions } from '../hooks/useContactActions';
import { useCustomerList } from '../hooks/useCustomerList';
import { useNow } from '../hooks/useNow';
import { customerHref, deletedHref, newCustomerHref, type CustomerListSeed } from '../logic/links';
import { pickContact } from '../pickContact';
import { CustomerFilters, CustomerSortSheet } from './CustomerFilters';
import { CustomerRow } from './CustomerRow';

/** Customers tab (PLAN §4.8): search, type chips, filters, sort, quick WhatsApp/Call, "+ Customer". */
export function CustomersScreen({ seed = null }: { seed?: CustomerListSeed | null } = {}) {
  const { colors, space } = useTheme();
  const { t } = useTranslation('customers');
  const toast = useToast();
  const list = useCustomerList(seed);
  const contact = useContactActions();
  const [sortOpen, setSortOpen] = useState(false);
  const now = useNow();

  const open = (row: CustomerListRow) => router.push(customerHref(row.id));
  const add = () => router.push(newCustomerHref());

  const addFromContacts = async () => {
    const res = await pickContact();
    if (res.status === 'cancelled') return;
    if (res.status === 'denied') return void toast.show({ message: t('form.contactsDenied') });
    if (res.status === 'error') return void toast.show({ message: t('form.contactsError'), tone: 'danger' });
    router.push(newCustomerHref({ name: res.name, phone: res.phone }));
  };

  if (!list.anyCustomers) {
    return (
      <Screen title={t('title')}>
        <EmptyState
          illustration={<LoomEmptyState width={240} />}
          title={t('empty.title')}
          body={t('empty.body')}
          actionLabel={t('empty.fromContacts')}
          actionIcon="contacts"
          onAction={addFromContacts}
        />
        <View style={{ gap: space.sm, paddingBottom: space.xl }}>
          <Button testID="customers-empty-add" label={t('empty.add')} icon="person-add" variant="secondary" size="lg" fullWidth onPress={add} />
          <Button label={t('list.deletedLink')} variant="ghost" icon="restore-from-trash" onPress={() => router.push(deletedHref())} />
        </View>
      </Screen>
    );
  }

  const query = list.search.trim();

  return (
    <Screen padded={false} title={t('title')} subtitle={t('summary', { count: list.totalCount })}>
      <FlashList
        data={list.rows}
        keyExtractor={(r) => r.id}
        extraData={now}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <CustomerFilters
            search={list.search}
            onSearch={list.setSearch}
            tag={list.tag}
            onTag={list.setTag}
            followUpDue={list.followUpDue}
            onFollowUpDue={list.toggleFollowUpDue}
            inactive={list.inactive}
            onInactive={list.toggleInactive}
            sort={list.sort}
            onOpenSort={() => setSortOpen(true)}
          />
        }
        ListEmptyComponent={
          <View style={{ gap: space.sm, paddingHorizontal: space.lg }}>
            <EmptyState
              title={t('empty.noMatchTitle')}
              body={query ? t('empty.noMatchSearch', { query }) : t('empty.noMatchFilter')}
              actionLabel={t('empty.clear')}
              actionIcon="filter-alt-off"
              onAction={list.clearFilters}
            />
            {query && !/^\+?[\d\s-]+$/.test(query) ? (
              <Button
                label={t('empty.addNamed', { query })}
                icon="person-add"
                variant="ghost"
                onPress={() => router.push(newCustomerHref({ name: query }))}
              />
            ) : null}
          </View>
        }
        ListFooterComponent={
          list.rows.length > 0 ? (
            <Button label={t('list.deletedLink')} variant="ghost" icon="restore-from-trash" onPress={() => router.push(deletedHref())} style={{ alignSelf: 'center', marginTop: space.lg }} />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border, marginStart: space.lg + 44 + space.md }]} />}
        renderItem={({ item }) => (
          <CustomerRow row={item} now={now} onPress={open} onWhatsApp={(r) => void contact.whatsapp(r.phone)} onCall={(r) => void contact.call(r.phone)} />
        )}
      />

      <View pointerEvents="box-none" style={[styles.bottom, { paddingHorizontal: space.lg, paddingBottom: space.lg }]}>
        <Button testID="customers-add" label={t('add')} accessibilityHint={t('addLabel')} icon="add" size="lg" onPress={add} />
      </View>

      <CustomerSortSheet visible={sortOpen} sort={list.sort} onSort={list.setSort} onClose={() => setSortOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  separator: { height: StyleSheet.hairlineWidth },
  bottom: { position: 'absolute', start: 0, end: 0, bottom: 0, alignItems: 'flex-end' },
});
