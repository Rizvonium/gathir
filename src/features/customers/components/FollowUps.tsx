import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CustomerEvent } from '@/db/schema';
import { formatDay } from '@/lib/dates';
import { AppSheet, AppText, Button, Chip, Icon, SectionHeader, TextField } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { atReminderHour, FOLLOW_UP_CHOICES, followUpDue, followUpDueAt, type FollowUpChoice } from '../logic/customerLogic';

export type FollowUpListProps = {
  events: CustomerEvent[];
  now: number;
  canMessage: boolean;
  onAdd: () => void;
  onDone: (event: CustomerEvent) => void;
  onMessage: (event: CustomerEvent) => void;
};

/** Open follow-ups (overdue first) with Done / Message, and the "Remind me" entry point. */
export function FollowUpList({ events, now, canMessage, onAdd, onDone, onMessage }: FollowUpListProps) {
  const { space, colors, radius } = useTheme();
  const { t } = useTranslation('customers');
  return (
    <View style={{ gap: space.sm }}>
      <SectionHeader title={t('followUp.title')} actionLabel={events.length ? t('followUp.add') : undefined} onAction={onAdd} />
      {events.length === 0 ? (
        <Button testID="follow-up-add" label={t('followUp.add')} icon="alarm-add" variant="secondary" accessibilityHint={t('followUp.addLabel')} onPress={onAdd} />
      ) : (
        events.map((e) => {
          const due = followUpDue(e.dueAt ?? now, now);
          const tone = due.overdue ? 'danger' : due.due ? 'primary' : 'textMuted';
          const label = t(due.key, { count: due.count });
          return (
            <View
              key={e.id}
              testID={`follow-up-${e.id}`}
              style={[styles.card, { gap: space.sm, padding: space.md, borderRadius: radius.md, borderColor: due.due ? colors[tone] : colors.border, backgroundColor: colors.surface }]}>
              <View style={[styles.row, { gap: space.sm }]}>
                <Icon name={due.due ? 'notifications-active' : 'alarm'} tone={tone} size={20} />
                <AppText weight="bold" tone={tone}>
                  {label}
                </AppText>
                <AppText variant="small" muted>
                  {e.dueAt !== null ? formatDay(e.dueAt) : ''}
                </AppText>
              </View>
              {e.note ? <AppText>{e.note}</AppText> : null}
              <View style={[styles.row, { gap: space.sm }]}>
                <Button testID={`follow-up-done-${e.id}`} label={t('followUp.done')} icon="check" size="sm" variant="tonal" accessibilityHint={t('followUp.doneLabel')} onPress={() => onDone(e)} />
                {canMessage ? <Button label={t('followUp.message')} icon="chat" size="sm" variant="ghost" onPress={() => onMessage(e)} /> : null}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

export type FollowUpSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (dueAt: number, note: string) => void;
  /** Current time (from useNow) the quick choices count from. */
  now: number;
};

type When = { kind: 'choice'; choice: FollowUpChoice } | { kind: 'date'; dayMs: number };

/** Date chips (Tomorrow … 1 month) or a calendar date, an optional note, then "Set reminder". */
export function FollowUpSheet({ visible, onClose, onSave, now }: FollowUpSheetProps) {
  const { space } = useTheme();
  const { t } = useTranslation('customers');
  const [when, setWhen] = useState<When>({ kind: 'choice', choice: 'weeks2' });
  const [note, setNote] = useState('');
  const [picking, setPicking] = useState(false);

  const base = now;
  const dueAt = when.kind === 'choice' ? followUpDueAt(when.choice, base) : atReminderHour(when.dayMs);

  const save = () => {
    onSave(dueAt, note);
    setNote('');
    setWhen({ kind: 'choice', choice: 'weeks2' });
    onClose();
  };

  return (
    <>
      <AppSheet visible={visible} onClose={onClose} title={t('followUp.sheetTitle')} testID="follow-up-sheet">
        <AppText weight="semibold">{t('followUp.when')}</AppText>
        <View style={[styles.wrap, { gap: space.sm }]} accessibilityRole="radiogroup" accessibilityLabel={t('followUp.when')}>
          {FOLLOW_UP_CHOICES.map((c) => (
            <Chip
              key={c}
              testID={`follow-up-choice-${c}`}
              role="radio"
              label={t(`followUp.choices.${c}`)}
              selected={when.kind === 'choice' && when.choice === c}
              onPress={() => setWhen({ kind: 'choice', choice: c })}
            />
          ))}
          <Chip
            testID="follow-up-pick-date"
            role="radio"
            icon="event"
            label={when.kind === 'date' ? t('followUp.picked', { date: formatDay(when.dayMs) }) : t('followUp.pickDate')}
            selected={when.kind === 'date'}
            onPress={() => setPicking(true)}
          />
        </View>
        <TextField
          testID="follow-up-note"
          label={t('followUp.note')}
          placeholder={t('followUp.notePlaceholder')}
          value={note}
          onChangeText={setNote}
          autoCapitalize="sentences"
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <Button testID="follow-up-save" label={`${t('followUp.save')} · ${formatDay(dueAt)}`} icon="alarm-add" size="lg" fullWidth onPress={save} />
      </AppSheet>
      {picking ? (
        <DateTimePicker
          value={new Date(dueAt)}
          mode="date"
          presentation="dialog"
          minimumDate={new Date(base)}
          onValueChange={(_e, date) => {
            setPicking(false);
            setWhen({ kind: 'date', dayMs: date.getTime() });
          }}
          onDismiss={() => setPicking(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
