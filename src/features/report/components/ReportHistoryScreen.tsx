/** /report/history — owner reports that were sent: when, which days, how many sales, how much. */
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatDate, formatTime } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { AppText, Button, Card, EmptyState, Icon, IconButton, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import type { HistoryRow } from '../history';
import { useReportHistory } from '../hooks/useReportHistory';

export function ReportHistoryScreen() {
  const { t } = useTranslation('report');
  const { space } = useTheme();
  const h = useReportHistory();

  return (
    <Screen
      testID="report-history-screen"
      title={t('history.title')}
      edges={['top', 'bottom']}
      padded={false}
      leading={<IconButton icon="arrow-back" accessibilityLabel={t('screen.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/more'))} />}>
      <FlashList
        data={h.rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        ListHeaderComponent={<View style={{ height: space.lg }} />}
        ListEmptyComponent={
          <EmptyState
            illustration={<Icon name="outgoing-mail" size={48} tone="textMuted" />}
            title={t('history.emptyTitle')}
            body={t('history.emptyBody')}
            actionLabel={t('history.emptyAction')}
            actionIcon="send"
            onAction={() => router.replace('/report')}
          />
        }
        renderItem={({ item }) => (
          <HistoryCard row={item} hasFile={h.hasFile(item)} busy={h.busyId === item.id} onReshare={() => h.reshare(item)} onMakeAgain={() => h.makeAgain(item)} />
        )}
      />
    </Screen>
  );
}

function HistoryCard({ row, hasFile, busy, onReshare, onMakeAgain }: { row: HistoryRow; hasFile: boolean; busy: boolean; onReshare: () => void; onMakeAgain: () => void }) {
  const { t } = useTranslation('report');
  const { space } = useTheme();
  const period = row.from !== null && row.to !== null ? t('period.range', { from: formatDate(row.from), to: formatDate(row.to) }) : '';
  const sales = t('history.sales', { count: row.summary.saleCount });
  const title = t('history.rowTitle', { number: row.number });
  const sent = t('history.sentOn', { date: formatDate(row.sentAt), time: formatTime(row.sentAt) });

  return (
    <Card testID={`history-${row.id}`} padding="lg">
      <View style={{ gap: space.sm }}>
        <View style={styles.row} accessible accessibilityLabel={`${title}. ${sent}. ${period}. ${sales}, ${formatINR(row.summary.amountPaise)}`}>
          <View style={styles.flex}>
            <AppText variant="title">{title}</AppText>
            <AppText variant="small" muted>
              {sent}
            </AppText>
          </View>
          <AppText variant="title" numeric>
            {formatINR(row.summary.amountPaise)}
          </AppText>
        </View>
        <AppText muted>{period}</AppText>
        <AppText variant="small">{sales}</AppText>
        {hasFile ? (
          <Button label={t('history.reshare')} icon="share" variant="secondary" size="md" loading={busy} disabled={busy} onPress={onReshare} />
        ) : (
          <View style={{ gap: space.xs }}>
            <AppText variant="small" muted>
              {t('history.fileGone')}
            </AppText>
            {row.from !== null ? <Button label={t('history.makeAgain')} icon="refresh" variant="ghost" size="md" onPress={onMakeAgain} /> : null}
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
});
