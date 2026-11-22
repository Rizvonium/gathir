import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import type { StockHistoryRow } from '@/db/repo/productQueries';
import { formatDate, formatTime } from '@/lib/dates';
import { AppText, Button, ColourSwatch, Icon, PressableScale } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { saleHref } from '../logic/links';
import { dayLabelKey, historyLine, REASON_ICONS } from '../logic/view';

const FIRST_PAGE = 8;

export function whenLabel(t: TFunction<'stock'>, at: number, now: number): string {
  const day = dayLabelKey(at, now);
  const time = formatTime(at);
  if (day) return t(`history.${day}`, { time });
  return t('history.on', { date: formatDate(at), time });
}

/** Stock history timeline, newest first. Sold lines link to their sale. */
export function HistoryList({ rows, now }: { rows: StockHistoryRow[]; now: number }) {
  const { colors, space, radius } = useTheme();
  const { t } = useTranslation('stock');
  const [all, setAll] = useState(false);
  if (rows.length === 0) return <AppText muted>{t('detail.historyEmpty')}</AppText>;
  const shown = all ? rows : rows.slice(0, FIRST_PAGE);

  return (
    <View>
      {shown.map((row, i) => {
        const line = historyLine(row);
        const change = t('history.line', { sign: line.sign, amount: line.amount, reason: t(line.reasonKey) });
        const when = whenLabel(t, row.at, now);
        const content = (
          <View style={[styles.row, { gap: space.md, paddingVertical: space.sm }]}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.iconWrap,
                  { borderRadius: radius.pill, backgroundColor: line.tone === 'up' ? colors.stockOk : colors.surfaceSunken },
                ]}>
                <Icon name={REASON_ICONS[row.reason]} size={18} color={line.tone === 'up' ? colors.onAccent : colors.text} />
              </View>
              {i < shown.length - 1 ? <View style={[styles.line, { backgroundColor: colors.border }]} /> : null}
            </View>
            <View style={[styles.text, { gap: space.xxs }]}>
              <AppText weight="semibold" numeric>
                {change}
              </AppText>
              <View style={[styles.meta, { gap: space.xs }]}>
                <ColourSwatch hex={row.colourHex} name={row.colourName} size={12} />
                <AppText variant="small" muted numberOfLines={1} style={styles.flex}>
                  {[row.colourName, row.billNo ? t('history.bill', { billNo: row.billNo }) : null, row.note || null]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              </View>
              <AppText variant="caption" muted>
                {when}
              </AppText>
            </View>
            {row.saleId ? <Icon name="chevron-right" tone="textMuted" /> : null}
          </View>
        );
        const a11y = t('history.a11y', { change, colour: row.colourName, when });
        return row.saleId ? (
          <PressableScale key={row.id} scaleTo={0.99} accessibilityRole="link" accessibilityLabel={a11y} onPress={() => router.push(saleHref(row.saleId as string))}>
            {content}
          </PressableScale>
        ) : (
          <View key={row.id} accessible accessibilityLabel={a11y}>
            {content}
          </View>
        );
      })}
      {!all && rows.length > FIRST_PAGE ? (
        <Button label={t('detail.showAllHistory', { count: rows.length })} variant="ghost" icon="expand-more" onPress={() => setAll(true)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 56 },
  rail: { alignItems: 'center', alignSelf: 'stretch' },
  iconWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, marginTop: 4, marginBottom: -12 },
  text: { flex: 1, minWidth: 0 },
  meta: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
