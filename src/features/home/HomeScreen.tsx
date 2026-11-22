import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText, Button, EmptyState } from '@/ui/components';
import { LoomEmptyState, PatternHeader } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

import { AttentionStrip, BackupCard, FollowUps, QuickActions, ReportCard, SampleBanner, StockCard, TodayCard } from './HomeCards';
import { useHome, type HomeActions, type HomeModel } from './useHome';

/** Height of the woven band under the status bar. */
const BAND = 104;
/** How far the content sheet rises over the band. */
const OVERLAP = 28;

/** Home tab ("My Shop"). */
export function HomeScreen() {
  const { model, actions } = useHome();
  return <HomeView model={model} actions={actions} />;
}

/**
 * Layout only (props in, callbacks out) so every state can be rendered in tests.
 * A drifting boteh band sits under the status bar; the page rises over it like a cloth
 * laid on the counter, with the shop's name on top.
 */
export function HomeView({ model, actions }: { model: HomeModel; actions: HomeActions }) {
  const { t } = useTranslation('home');
  const { colors, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { summary } = model;

  return (
    <ScrollView testID="home" style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: space.xxxl }}>
      <View style={{ height: insets.top + BAND, backgroundColor: colors.surfaceSunken }}>
        <PatternHeader height={insets.top + BAND} />
      </View>
      <View
        style={[
          styles.sheet,
          {
            marginTop: -OVERLAP,
            backgroundColor: colors.bg,
            borderTopStartRadius: radius.sheet,
            borderTopEndRadius: radius.sheet,
            paddingHorizontal: space.lg,
            paddingTop: space.xl,
            gap: space.lg,
          },
        ]}>
        <View>
          <AppText muted weight="semibold">
            {t(`greeting.${model.greeting}`)}
          </AppText>
          <AppText variant="display" accessibilityRole="header" numberOfLines={2} testID="home-shop-name">
            {model.shopName || t('myShop')}
          </AppText>
        </View>

        {model.hasSample ? <SampleBanner onClear={actions.clearSample} /> : null}

        {model.emptyShop ? (
          <View testID="home-empty">
            <EmptyState
              illustration={<LoomEmptyState width={240} height={150} />}
              title={t('empty.title')}
              body={t('empty.body')}
              actionLabel={t('empty.add')}
              actionIcon="add-a-photo"
              onAction={() => router.push('/product/new' as Href)}
              style={styles.empty}
            />
            {!model.hasSample ? <Button testID="home-empty-sample" label={t('empty.sample')} variant="ghost" onPress={actions.trySample} /> : null}
          </View>
        ) : (
          <>
            <StockCard pieces={summary.totalPieces} designs={summary.designs} valuePaise={summary.stockValuePaise} />
            <TodayCard pieces={summary.todayPieces} amountPaise={summary.todayAmountPaise} compare={model.today} />
            <QuickActions />
            <AttentionStrip items={model.attention} total={model.attentionTotal} lowStockLevel={model.lowStockLevel} />
            <ReportCard status={model.report} />
          </>
        )}

        <FollowUps items={model.followUps} onMessage={actions.messageFollowUp} onDone={actions.completeFollowUp} />
        <BackupCard reminder={model.backup} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  empty: { flex: 0, paddingHorizontal: 0 },
});
