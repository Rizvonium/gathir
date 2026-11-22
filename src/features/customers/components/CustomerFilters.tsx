import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CustomerSort } from '@/db/repo/customerQueries';
import type { CustomerTag } from '@/db/schema';
import { AppSheet, Chip, Icon, IconButton, ListRow, TextField } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { TAG_ORDER } from '../logic/customerLogic';

export const SORTS: readonly CustomerSort[] = ['recent', 'spend', 'name'];

export type CustomerFiltersProps = {
  search: string;
  onSearch: (text: string) => void;
  tag: CustomerTag | null;
  onTag: (tag: CustomerTag | null) => void;
  followUpDue: boolean;
  onFollowUpDue: () => void;
  inactive: boolean;
  onInactive: () => void;
  sort: CustomerSort;
  onOpenSort: () => void;
};

/** Search, customer-type chips, then filter + sort chips. Chip rows scroll sideways. */
export function CustomerFilters(p: CustomerFiltersProps) {
  const { space } = useTheme();
  const { t } = useTranslation('customers');
  const rowStyle = [styles.row, { paddingHorizontal: space.lg, gap: space.sm }];

  return (
    <View style={{ gap: space.sm, paddingBottom: space.sm }}>
      <View style={{ paddingHorizontal: space.lg }}>
        <TextField
          testID="customers-search"
          label={t('list.search')}
          value={p.search}
          onChangeText={p.onSearch}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="words"
          suffix={p.search ? <IconButton icon="close" size={40} accessibilityLabel={t('list.searchClear')} onPress={() => p.onSearch('')} /> : undefined}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel={t('list.tagsLabel')}
        contentContainerStyle={rowStyle}>
        <Chip label={t('list.all')} role="radio" selected={p.tag === null} onPress={() => p.onTag(null)} testID="customers-tag-all" />
        {TAG_ORDER.map((tag) => (
          <Chip
            key={tag}
            testID={`customers-tag-${tag}`}
            label={t(`tags.${tag}`)}
            role="radio"
            selected={p.tag === tag}
            onPress={() => p.onTag(p.tag === tag ? null : tag)}
          />
        ))}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel={t('list.filtersLabel')}
        contentContainerStyle={rowStyle}>
        <Chip testID="customers-filter-due" label={t('list.followUpDue')} icon="alarm" role="checkbox" selected={p.followUpDue} onPress={p.onFollowUpDue} />
        <Chip testID="customers-filter-inactive" label={t('list.inactive')} icon="history" role="checkbox" selected={p.inactive} onPress={p.onInactive} />
        <Chip testID="customers-sort" label={t('list.sortChip', { sort: t(`list.sort.${p.sort}`) })} icon="sort" onPress={p.onOpenSort} />
      </ScrollView>
    </View>
  );
}

export function CustomerSortSheet({ visible, sort, onSort, onClose }: { visible: boolean; sort: CustomerSort; onSort: (s: CustomerSort) => void; onClose: () => void }) {
  const { t } = useTranslation('customers');
  const { space } = useTheme();
  return (
    <AppSheet visible={visible} onClose={onClose} title={t('list.sortTitle')}>
      <View accessibilityRole="radiogroup">
        {SORTS.map((s) => (
          <ListRow
            key={s}
            testID={`customers-sort-${s}`}
            title={t(`list.sort.${s}`)}
            chevron={false}
            trailing={s === sort ? <Icon name="check" tone="primary" /> : undefined}
            accessibilityLabel={s === sort ? t('list.sortSelected', { sort: t(`list.sort.${s}`) }) : t(`list.sort.${s}`)}
            onPress={() => {
              onSort(s);
              onClose();
            }}
            style={{ marginHorizontal: -space.lg }}
          />
        ))}
      </View>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
