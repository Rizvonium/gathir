/**
 * /settings/stock — low-stock level (saved on every tap, no Save button) and categories.
 * Reorder uses visible up/down buttons (no drag gesture to discover; TalkBack friendly).
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useLowStockLevel } from '@/db/hooks';
import type { CategoryWithCount } from '@/db/repo/categories';
import { updateSettings } from '@/db/repo/settings';
import { AppSheet, AppText, Button, Card, Divider, Icon, IconButton, SectionHeader, Stepper, TextField, useToast } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { useCategoryEditor, type NameError } from '../hooks/useCategoryEditor';
import { LOW_STOCK_MAX, LOW_STOCK_MIN } from '../settingsLogic';
import { SubScreen } from './SubScreen';

export function StockSettingsScreen() {
  const { t } = useTranslation('settings');
  const { space } = useTheme();
  const level = useLowStockLevel();
  const toast = useToast();
  const c = useCategoryEditor();

  const nameError = (e: NameError) => (e === 'required' ? t('stock.nameRequired') : e === 'duplicate' ? t('stock.nameDuplicate') : undefined);

  const setLevel = (n: number) => {
    try {
      updateSettings(db, { lowStockLevel: n });
    } catch {
      toast.show({ message: t('saveFailed'), tone: 'danger' });
    }
  };

  return (
    <SubScreen testID="settings-stock" title={t('stock.title')}>
      <View style={{ gap: space.sm }}>
        <SectionHeader title={t('stock.lowTitle')} />
        <Card padding="lg">
          <View style={{ gap: space.md }}>
            <AppText muted>{t('stock.lowBody')}</AppText>
            <View style={[styles.row, { gap: space.md }]}>
              <View style={styles.flex}>
                <AppText variant="small" muted>
                  {t('stock.lowLabel')}
                </AppText>
                <AppText variant="title" accessibilityLiveRegion="polite">
                  {level === 0 ? t('stock.lowOff') : t('stock.lowValue', { count: level })}
                </AppText>
              </View>
              <Stepper
                testID="low-stock"
                value={level}
                onChange={setLevel}
                min={LOW_STOCK_MIN}
                max={LOW_STOCK_MAX}
                size="lg"
                accessibilityLabel={t('stock.lowTitle')}
              />
            </View>
          </View>
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <SectionHeader title={t('stock.categoriesTitle')} />
        <AppText variant="small" muted>
          {t('stock.categoriesBody')}
        </AppText>
        <View style={[styles.addRow, { gap: space.sm }]}>
          <TextField
            testID="category-new"
            style={styles.flex}
            label={t('stock.newLabel')}
            placeholder={t('stock.addPlaceholder')}
            value={c.draft}
            onChangeText={c.setDraft}
            error={nameError(c.draftError)}
            maxLength={30}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={c.add}
          />
        </View>
        <Button testID="category-add" label={t('stock.add')} icon="add" variant="tonal" fullWidth onPress={c.add} />

        <Card padding="none" style={{ overflow: 'hidden' }}>
          {c.list.length === 0 ? (
            <View style={{ padding: space.lg }}>
              <AppText muted>{t('stock.empty')}</AppText>
            </View>
          ) : (
            c.list.map((cat, i) => (
              <View key={cat.id}>
                {i > 0 ? <Divider inset={16} /> : null}
                <CategoryRow
                  cat={cat}
                  first={i === 0}
                  last={i === c.list.length - 1}
                  onUp={() => c.move(i, -1)}
                  onDown={() => c.move(i, 1)}
                  onRename={() => c.startRename(cat)}
                  onDelete={() => c.remove(cat)}
                />
              </View>
            ))
          )}
        </Card>
      </View>

      <AppSheet visible={c.renaming !== null} onClose={c.cancelRename} title={t('stock.renameTitle')}>
        <View style={{ gap: space.md }}>
          <TextField
            testID="category-rename"
            label={t('stock.nameLabel')}
            value={c.renameText}
            onChangeText={c.setRenameText}
            error={nameError(c.renameError)}
            maxLength={30}
            autoCapitalize="words"
            autoFocus
            onSubmitEditing={c.saveRename}
          />
          <Button testID="category-rename-save" label={t('stock.renameSave')} icon="check" size="lg" fullWidth onPress={c.saveRename} />
        </View>
      </AppSheet>
    </SubScreen>
  );
}

function CategoryRow({
  cat,
  first,
  last,
  onUp,
  onDown,
  onRename,
  onDelete,
}: {
  cat: CategoryWithCount;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation('settings');
  const { space } = useTheme();
  return (
    <View testID={`category-${cat.id}`} style={[styles.row, { paddingStart: space.lg, paddingEnd: space.xs, paddingVertical: space.xs, gap: space.sm }]}>
      <Icon name="category" tone="teal" />
      <View style={styles.flex} accessible accessibilityLabel={`${cat.name}, ${t('stock.designs', { count: cat.productCount })}`}>
        <AppText weight="semibold" numberOfLines={2}>
          {cat.name}
        </AppText>
        <AppText variant="small" muted>
          {t('stock.designs', { count: cat.productCount })}
        </AppText>
      </View>
      <IconButton icon="arrow-upward" accessibilityLabel={t('stock.moveUp', { name: cat.name })} onPress={onUp} disabled={first} />
      <IconButton icon="arrow-downward" accessibilityLabel={t('stock.moveDown', { name: cat.name })} onPress={onDown} disabled={last} />
      <IconButton icon="edit" accessibilityLabel={`${t('stock.rename')} ${cat.name}`} onPress={onRename} />
      <IconButton icon="delete-outline" accessibilityLabel={t('stock.delete', { name: cat.name })} onPress={onDelete} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  addRow: { flexDirection: 'row', alignItems: 'flex-start' },
});
