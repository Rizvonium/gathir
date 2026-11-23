/**
 * Showroom (PLAN §4.9): hand the phone to a customer. Full screen, screen kept awake, swipe through
 * in-stock shawls edge to edge, pinch to see the weave. After 45 s untouched it plays a slow
 * slideshow. Leaving takes a 1.5 s hold on the corner mark (and the PIN when one is set).
 */
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import type { ProductListRow } from '@/db/repo/productQueries';
import { AppText, Chip, EmptyState, playHaptic, useReduceMotionEnabled } from '@/ui/components';
import { LoomEmptyState, PatternHeader, useAppActive } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

import { useIdle } from '../hooks/useIdle';
import { useShowroom } from '../hooks/useShowroom';
import { useShowroomExit } from '../hooks/useShowroomExit';
import { enterShowroom } from '../logic/session';
import { ATTRACT_STEP_MS, IDLE_MS, nextSlide } from '../logic/showroom';
import { ExitMark } from './ExitMark';
import { SendMeThisSheet, type Chosen } from './SendMeThisSheet';
import { ShowroomOverlay, stage } from './ShowroomOverlay';
import { ShowroomSlide } from './ShowroomSlide';

const BAND_HEIGHT = 76;
const HINT_MS = 3_000;

export function ShowroomScreen() {
  useKeepAwake();
  // While mounted: links are ignored, reminders stay quiet and their taps wait (see logic/session).
  useEffect(() => enterShowroom(), []);
  const { t } = useTranslation('showroom');
  const { colors, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReduceMotionEnabled();
  // The slide's drift pauses under the card / catalogue screens "Send me this" pushes.
  const focused = useIsFocused();
  const appActive = useAppActive();
  const onScreen = focused && appActive;
  const s = useShowroom();

  const listRef = useRef<FlashListRef<ProductListRow>>(null);
  const indexRef = useRef(0);
  const [index, setIndexState] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [liked, setLiked] = useState<Record<string, string[]>>({});
  const [exitHint, setExitHint] = useState(false);
  const { idle, poke } = useIdle(IDLE_MS, !sheetOpen && s.products.length > 1);

  const setIndex = (i: number) => {
    indexRef.current = i;
    setIndexState(i);
  };
  const current = s.products[Math.min(index, Math.max(0, s.products.length - 1))] ?? null;

  const showExitHint = useCallback(() => {
    playHaptic('light');
    setExitHint(true);
  }, []);
  const exit = useShowroomExit({ pinSet: s.pinSet, onBackBlocked: showExitHint });

  useEffect(() => {
    if (!exitHint) return;
    const id = setTimeout(() => setExitHint(false), HINT_MS);
    return () => clearTimeout(id);
  }, [exitHint]);

  // Attract mode: a slow slideshow until someone touches the screen.
  useEffect(() => {
    if (!idle || s.products.length < 2) return;
    const id = setInterval(() => {
      const next = nextSlide(indexRef.current, s.products.length);
      listRef.current?.scrollToIndex({ index: next, animated: !reduced });
      setIndex(next);
    }, ATTRACT_STEP_MS);
    return () => clearInterval(id);
  }, [idle, s.products.length, reduced]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== indexRef.current) setIndex(next);
  };

  const chooseCategory = (id: string | null) => {
    s.setCategoryId(id);
    setIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const sendCard = (c: Chosen, productId: string) => router.push({ pathname: '/catalogue/card', params: { productId, customerId: c.id } });
  const sendMini = (c: Chosen) => router.push({ pathname: '/catalogue', params: { productIds: c.likedIds.join(','), customerId: c.id, quick: '1' } });

  const mark = <ExitMark onExit={exit} color={colors.text} trackColor={colors.border} />;

  return (
    <View style={[styles.root, { backgroundColor: stage.bg }]} onTouchStart={poke} testID="showroom">
      <StatusBar hidden style="light" />

      {s.products.length === 0 ? (
        <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + space.md }]}>
          <View style={[styles.cornerRow, { paddingHorizontal: space.md }]}>{mark}</View>
          <EmptyState illustration={<LoomEmptyState />} title={t('empty.title')} body={t('empty.body')} actionLabel={t('empty.leave')} actionIcon="logout" onAction={exit} />
        </View>
      ) : (
        <>
          <FlashList
            ref={listRef}
            data={s.products}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={!zoomed}
            keyExtractor={(p) => p.id}
            onMomentumScrollEnd={onScrollEnd}
            extraData={`${index}-${reduced}`}
            style={StyleSheet.absoluteFill}
            renderItem={({ item, index: i }) => (
              <ShowroomSlide product={item} index={i} width={width} height={height} active={i === index} onScreen={onScreen} reducedMotion={reduced} onZoomChange={setZoomed} />
            )}
          />

          {current && !zoomed ? (
            <ShowroomOverlay
              product={current}
              index={Math.min(index, s.products.length - 1)}
              total={s.products.length}
              lowStockLevel={s.lowStockLevel}
              showExactCounts={s.showExactCounts}
              bottomInset={insets.bottom}
              onSendMeThis={() => setSheetOpen(true)}
            />
          ) : null}

          <View style={[styles.band, { height: BAND_HEIGHT + insets.top, backgroundColor: colors.surfaceSunken }]}>
            <PatternHeader height={BAND_HEIGHT + insets.top} paused={sheetOpen || zoomed} style={StyleSheet.absoluteFill} />
            <View style={[styles.cornerRow, { paddingTop: insets.top, paddingStart: space.lg, paddingEnd: space.sm, gap: space.sm, height: BAND_HEIGHT + insets.top }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, alignItems: 'center' }} style={styles.flex}>
                <Chip label={t('all')} role="radio" selected={s.categoryId === null} onPress={() => chooseCategory(null)} />
                {s.rail.map((c) => (
                  <Chip key={c.id} label={c.name} role="radio" selected={s.categoryId === c.id} onPress={() => chooseCategory(c.id)} />
                ))}
              </ScrollView>
              {mark}
            </View>
          </View>

          {idle ? (
            <Animated.View entering={FadeIn.duration(reduced ? 0 : 300)} exiting={FadeOut.duration(reduced ? 0 : 160)} style={[styles.hintWrap, { top: BAND_HEIGHT + insets.top + space.lg }]} pointerEvents="none">
              <View style={[{ backgroundColor: stage.scrim, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm }]}>
                <AppText weight="semibold" color={stage.text}>
                  {t('attract')}
                </AppText>
              </View>
            </Animated.View>
          ) : null}
        </>
      )}

      {exitHint ? (
        <Animated.View entering={FadeIn.duration(reduced ? 0 : 160)} exiting={FadeOut.duration(reduced ? 0 : 160)} style={[styles.exitHint, { top: BAND_HEIGHT + insets.top + space.xs, end: space.md }]} accessibilityLiveRegion="polite">
          <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, borderColor: colors.border }, styles.exitCard]}>
            <AppText weight="semibold">{t('exit.backHint')}</AppText>
          </View>
        </Animated.View>
      ) : null}

      <SendMeThisSheet
        product={current}
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        liked={liked}
        onLiked={(id, ids) => setLiked((m) => ({ ...m, [id]: ids }))}
        onSendCard={sendCard}
        onSendMini={sendMini}
        pinSet={s.pinSet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  band: { position: 'absolute', top: 0, start: 0, end: 0, overflow: 'hidden' },
  cornerRow: { flexDirection: 'row', alignItems: 'center' },
  hintWrap: { position: 'absolute', start: 0, end: 0, alignItems: 'center' },
  exitHint: { position: 'absolute', maxWidth: 280 },
  exitCard: { borderWidth: StyleSheet.hairlineWidth },
});
