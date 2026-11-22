/** "Which sales?": period chips, plus a row of day chips for Choose dates. */
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatDay } from '@/lib/dates';
import { AppText, Chip, ChipGroup } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { isDayInRange, PERIOD_KINDS, recentDays, type PeriodKind } from '../period';

export type PeriodPickerProps = {
  kind: PeriodKind;
  onKind: (kind: PeriodKind) => void;
  now: number;
  customFrom: number | null;
  customTo: number | null;
  onPickDay: (day: number) => void;
};

export function PeriodPicker({ kind, onKind, now, customFrom, customTo, onPickDay }: PeriodPickerProps) {
  const { t } = useTranslation('report');
  const { space } = useTheme();
  const days = recentDays(now);
  const dayLabel = (i: number, day: number) => (i === 0 ? t('period.todayChip') : i === 1 ? t('period.yesterdayChip') : formatDay(day));

  return (
    <View style={{ gap: space.md }}>
      <ChipGroup
        testID="report-period"
        mode="single"
        accessibilityLabel={t('period.title')}
        value={kind}
        onChange={onKind}
        options={PERIOD_KINDS.map((k) => ({ value: k, label: t(`period.kinds.${k}`), icon: k === 'custom' ? 'date-range' : undefined }))}
      />
      {kind === 'custom' ? (
        <View style={{ gap: space.sm }}>
          <AppText variant="small" muted>
            {t('period.customHint')}
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.days, { gap: space.sm }]}
            accessibilityLabel={t('period.customDays')}>
            {days.map((day, i) => (
              <Chip
                key={day}
                testID={`report-day-${i}`}
                role="checkbox"
                label={dayLabel(i, day)}
                selected={isDayInRange(day, customFrom, customTo)}
                onPress={() => onPickDay(day)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  days: { paddingEnd: 16 },
});
