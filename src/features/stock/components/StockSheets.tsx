import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Category } from '@/db/schema';
import type { ProductListRow, ProductSort } from '@/db/repo/productQueries';
import { AppSheet } from '@/ui/components';

import { SORTS } from '../logic/view';
import { SheetOption } from './SheetOption';

export function SortSheet({ visible, sort, onSort, onClose }: { visible: boolean; sort: ProductSort; onSort: (s: ProductSort) => void; onClose: () => void }) {
  const { t } = useTranslation('stock');
  return (
    <AppSheet visible={visible} onClose={onClose} title={t('sort.title')}>
      <View accessibilityRole="radiogroup">
        {SORTS.map((s) => (
          <SheetOption
            key={s}
            testID={`sort-${s}`}
            role="radio"
            label={t(`sort.${s}`)}
            selected={s === sort}
            onPress={() => {
              onSort(s);
              onClose();
            }}
          />
        ))}
      </View>
    </AppSheet>
  );
}

export type RowMenuAction = 'sell' | 'open' | 'edit' | 'send' | 'select' | 'delete';

/** The visible alternative to row swipes and long-press. */
export function RowMenuSheet({ row, onAction, onClose }: { row: ProductListRow | null; onAction: (a: RowMenuAction, row: ProductListRow) => void; onClose: () => void }) {
  const { t } = useTranslation('stock');
  const items: { action: RowMenuAction; icon: Parameters<typeof SheetOption>[0]['icon']; danger?: boolean; disabled?: boolean }[] = [
    { action: 'sell', icon: 'sell', disabled: !row || row.totalPieces === 0 },
    { action: 'open', icon: 'open-in-new' },
    { action: 'edit', icon: 'edit' },
    { action: 'send', icon: 'send' },
    { action: 'select', icon: 'check-box' },
    { action: 'delete', icon: 'delete-outline', danger: true },
  ];
  return (
    <AppSheet visible={row !== null} onClose={onClose} title={row?.name}>
      {items.map((it) => (
        <SheetOption
          key={it.action}
          testID={`row-menu-${it.action}`}
          icon={it.icon}
          label={t(`rowMenu.${it.action}`)}
          tone={it.danger ? 'danger' : 'default'}
          disabled={it.disabled}
          onPress={() => {
            if (!row) return;
            onClose();
            onAction(it.action, row);
          }}
        />
      ))}
    </AppSheet>
  );
}

export function CategorySheet({
  visible,
  categories,
  onPick,
  onClose,
}: {
  visible: boolean;
  categories: Category[];
  onPick: (id: string | null, name: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('stock');
  return (
    <AppSheet visible={visible} onClose={onClose} title={t('select.categoryTitle')} snapPoints={['half', 'full']}>
      {categories.map((c) => (
        <SheetOption
          key={c.id}
          icon="label-outline"
          label={c.name}
          onPress={() => {
            onClose();
            onPick(c.id, c.name);
          }}
        />
      ))}
      <SheetOption
        icon="label-off"
        label={t('select.categoryNone')}
        onPress={() => {
          onClose();
          onPick(null, t('select.categoryNone'));
        }}
      />
    </AppSheet>
  );
}
