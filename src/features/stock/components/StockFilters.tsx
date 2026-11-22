import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Category } from '@/db/schema';
import type { ProductFilter } from '@/db/repo/productQueries';
import { Chip, IconButton, TextField } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { FILTERS } from '../logic/view';

export type StockFiltersProps = {
  search: string;
  onSearch: (text: string) => void;
  categories: Category[];
  categoryId: string | null;
  onCategory: (id: string | null) => void;
  filter: ProductFilter;
  onFilter: (f: ProductFilter) => void;
};

/** Search field, category chips and stock filter chips (each chip row scrolls sideways). */
export function StockFilters({ search, onSearch, categories, categoryId, onCategory, filter, onFilter }: StockFiltersProps) {
  const { space } = useTheme();
  const { t } = useTranslation('stock');
  const rowStyle = { paddingHorizontal: space.lg, gap: space.sm };

  return (
    <View style={{ gap: space.sm, paddingBottom: space.sm }}>
      <View style={{ paddingHorizontal: space.lg }}>
        <TextField
          testID="stock-search"
          label={t('search.label')}
          placeholder={t('search.placeholder')}
          value={search}
          onChangeText={onSearch}
          returnKeyType="search"
          autoCorrect={false}
          suffix={search ? <IconButton icon="close" accessibilityLabel={t('search.clear')} onPress={() => onSearch('')} size={40} /> : undefined}
        />
      </View>
      {categories.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          accessibilityLabel={t('categories.label')}
          contentContainerStyle={[styles.row, rowStyle]}>
          <Chip label={t('categories.all')} role="radio" selected={categoryId === null} onPress={() => onCategory(null)} />
          {categories.map((c) => (
            <Chip key={c.id} label={c.name} role="radio" selected={categoryId === c.id} onPress={() => onCategory(categoryId === c.id ? null : c.id)} />
          ))}
        </ScrollView>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel={t('filters.label')}
        contentContainerStyle={[styles.row, rowStyle]}>
        {FILTERS.map((f) => (
          <Chip
            key={f}
            testID={`stock-filter-${f}`}
            label={t(`filters.${f}`)}
            role="radio"
            icon={f === 'low' ? 'error-outline' : f === 'out' ? 'remove-circle-outline' : f === 'in' ? 'check-circle' : undefined}
            selected={filter === f}
            onPress={() => onFilter(f)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
