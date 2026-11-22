import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CustomerLikes } from '@/db/schema';
import { AppText, Button, Card, Chip, ColourSwatch, Icon, SectionHeader } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { hasBudget, likesEmpty, swatchHex, swatchName, type LikesSuggestion } from '../logic/customerLogic';
import { LikesEditor } from './LikesEditor';
import { joinLikes, useBudgetLabel } from './likesText';

export type LikesSectionProps = {
  likes: CustomerLikes;
  suggestion: LikesSuggestion | null;
  onSave: (likes: CustomerLikes) => boolean;
  onAccept: () => void;
  onDismiss: () => void;
};

/** Likes chips with inline editing (each tap saves) and the "learned from purchases" offer. */
export function LikesSection({ likes, suggestion, onSave, onAccept, onDismiss }: LikesSectionProps) {
  const { space, colors, radius } = useTheme();
  const { t } = useTranslation('customers');
  const budgetLabel = useBudgetLabel();
  const [editing, setEditing] = useState(false);
  const empty = likesEmpty(likes);

  const learnedParts = suggestion ? joinLikes(suggestion.crafts, suggestion.colours) : '';
  const learnedBudget = suggestion?.budget ? budgetLabel(suggestion.budget.minPaise, suggestion.budget.maxPaise) : '';
  const learnedList = [learnedParts, learnedBudget].filter(Boolean).join(', ');

  return (
    <View style={{ gap: space.sm }}>
      <SectionHeader
        title={t('likes.title')}
        actionLabel={editing ? t('likes.done') : empty ? t('likes.add') : t('likes.edit')}
        onAction={() => setEditing((v) => !v)}
      />

      {suggestion && !editing ? (
        <View
          testID="learned-suggestion"
          style={[styles.learned, { gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
          <View style={[styles.row, { gap: space.sm }]}>
            <Icon name="auto-awesome" tone="primary" size={20} />
            <AppText variant="small" weight="semibold" tone="textMuted">
              {t('learned.title')}
            </AppText>
          </View>
          <AppText accessibilityLabel={t('learned.label', { list: learnedList })}>{t('learned.usually', { list: learnedList })}</AppText>
          <View style={[styles.row, { gap: space.sm }]}>
            <Button testID="learned-accept" label={t('learned.accept')} icon="add" size="sm" variant="tonal" onPress={onAccept} />
            <Button label={t('learned.dismiss')} size="sm" variant="ghost" onPress={onDismiss} />
          </View>
        </View>
      ) : null}

      {editing ? (
        <Card>
          <LikesEditor testID="likes-editor" likes={likes} onChange={onSave} />
        </Card>
      ) : empty ? (
        <AppText muted>{t('likes.empty')}</AppText>
      ) : (
        <View style={[styles.wrap, { gap: space.sm }]}>
          {likes.colours.map((key) => (
            <Chip
              key={`c-${key}`}
              label={swatchName(key)}
              leading={<ColourSwatch hex={swatchHex(key) ?? (key === 'multi' ? 'multi' : colors.textMuted)} name={swatchName(key)} size={18} />}
              onPress={() => setEditing(true)}
            />
          ))}
          {likes.crafts.map((c) => (
            <Chip key={`k-${c}`} label={c} icon="texture" onPress={() => setEditing(true)} />
          ))}
          {hasBudget(likes) ? (
            <Chip label={budgetLabel(likes.budgetMinPaise ?? 0, likes.budgetMaxPaise ?? 0)} icon="currency-rupee" onPress={() => setEditing(true)} />
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  learned: { borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
