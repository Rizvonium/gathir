import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTranslation } from 'react-i18next';

import type { Photo } from '@/db/schema';
import { photoUri, thumbUri } from '@/lib/photos';
import { playHaptic, useReduceMotionEnabled } from '@/ui/components';
import { springs } from '@/ui/motion';
import { useTheme } from '@/ui/theme';

import { clamp, DOUBLE_TAP_SCALE, doubleTapOffset, focalOffset, MAX_SCALE, maxOffset, MIN_SCALE, rubberBand } from '../logic/zoom';

export type PhotoGalleryProps = {
  photos: Photo[];
  name: string;
  /** Height/width ratio of the frame. Default 5:4 (portrait, like a folded shawl). */
  ratio?: number;
};

/**
 * Swipeable product photos. Each page pinch-zooms (to 4×, with rubber band at both ends) and
 * double-tap zooms to 2.5× on the tapped point; while zoomed, one finger pans and paging is
 * locked. TalkBack gets zoom in/out actions instead of gestures.
 */
export function PhotoGallery({ photos, name, ratio = 1.25 }: PhotoGalleryProps) {
  const { width } = useWindowDimensions();
  const { colors, space, radius } = useTheme();
  const { t } = useTranslation('stock');
  const [page, setPage] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const height = Math.round(width * ratio);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) {
      setPage(next);
      playHaptic('selection');
    }
  };

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed && photos.length > 1}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ width, height, backgroundColor: colors.surfaceSunken }}>
        {photos.map((p, i) => (
          <ZoomablePhoto
            key={p.id}
            photo={p}
            width={width}
            height={height}
            label={t('detail.photoOf', { index: i + 1, total: photos.length, name })}
            hint={t('detail.zoomHint')}
            onZoomChange={setZoomed}
          />
        ))}
      </ScrollView>
      {photos.length > 1 ? (
        <View style={[styles.dots, { bottom: space.md, gap: space.xs }]} importantForAccessibility="no-hide-descendants">
          {photos.map((p, i) => (
            <View
              key={p.id}
              style={[
                styles.dot,
                { borderRadius: radius.pill, backgroundColor: i === page ? colors.onPrimary : colors.scrim, width: i === page ? 20 : 8 },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

type ZoomableProps = {
  photo: Photo;
  width: number;
  height: number;
  label: string;
  hint: string;
  onZoomChange: (zoomed: boolean) => void;
};

function ZoomablePhoto({ photo, width, height, label, hint, onZoomChange }: ZoomableProps) {
  const reduced = useReduceMotionEnabled();
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const start = useSharedValue({ scale: 1, tx: 0, ty: 0, fx: 0, fy: 0 });
  const panEnabled = useSharedValue(false);

  /** Springs back inside the limits and reports zoom state to React (once, at the end). */
  const settle = (targetScale: number, targetX: number, targetY: number) => {
    'worklet';
    const s = clamp(targetScale, MIN_SCALE, MAX_SCALE);
    const mx = maxOffset(width, s);
    const my = maxOffset(height, s);
    scale.set(withSpring(s, springs.snap));
    tx.set(withSpring(clamp(targetX, -mx, mx), springs.snap));
    ty.set(withSpring(clamp(targetY, -my, my), springs.snap));
    const isZoomed = s > MIN_SCALE + 0.01;
    panEnabled.set(isZoomed);
    scheduleOnRN(onZoomChange, isZoomed);
  };

  const pinch = usePinchGesture({
    onActivate: (e) => {
      'worklet';
      start.set({ scale: scale.get(), tx: tx.get(), ty: ty.get(), fx: e.focalX - width / 2, fy: e.focalY - height / 2 });
    },
    onUpdate: (e) => {
      'worklet';
      const s0 = start.get();
      const next = rubberBand(s0.scale * e.scale, MIN_SCALE, MAX_SCALE);
      const ratio = next / s0.scale;
      scale.set(next);
      tx.set(focalOffset(s0.tx, s0.fx, e.focalX - width / 2, ratio));
      ty.set(focalOffset(s0.ty, s0.fy, e.focalY - height / 2, ratio));
    },
    onDeactivate: () => {
      'worklet';
      settle(scale.get(), tx.get(), ty.get());
    },
  });

  const pan = usePanGesture({
    enabled: panEnabled,
    maxPointers: 1,
    onBegin: () => {
      'worklet';
      start.set({ ...start.get(), tx: tx.get(), ty: ty.get() });
    },
    onUpdate: (e) => {
      'worklet';
      const s = scale.get();
      const mx = maxOffset(width, s);
      const my = maxOffset(height, s);
      tx.set(rubberBand(start.get().tx + e.translationX, -mx, mx));
      ty.set(rubberBand(start.get().ty + e.translationY, -my, my));
    },
    onDeactivate: () => {
      'worklet';
      settle(scale.get(), tx.get(), ty.get());
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onDeactivate: (e) => {
      'worklet';
      if (e.canceled) return;
      if (scale.get() > MIN_SCALE + 0.01) settle(MIN_SCALE, 0, 0);
      else settle(DOUBLE_TAP_SCALE, doubleTapOffset(e.x, width, DOUBLE_TAP_SCALE), doubleTapOffset(e.y, height, DOUBLE_TAP_SCALE));
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  const zoomTo = (s: number) => {
    scale.set(withSpring(s, springs.snap));
    tx.set(withSpring(0, springs.snap));
    ty.set(withSpring(0, springs.snap));
    panEnabled.set(s > MIN_SCALE);
    onZoomChange(s > MIN_SCALE);
  };

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{ width, height, overflow: 'hidden' }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityActions={[{ name: 'magnify' }, { name: 'zoomIn' }, { name: 'zoomOut' }]}
        onAccessibilityAction={(e) => {
          const action = e.nativeEvent.actionName;
          if (action === 'zoomIn' || action === 'magnify') zoomTo(DOUBLE_TAP_SCALE);
          if (action === 'zoomOut') zoomTo(MIN_SCALE);
        }}>
        <Animated.View style={[StyleSheet.absoluteFill, animated]}>
          <Image
            source={{ uri: photoUri(photo.fileName) }}
            placeholder={{ uri: thumbUri(photo.thumbName) }}
            placeholderContentFit="cover"
            contentFit="cover"
            transition={reduced ? 0 : 160}
            recyclingKey={photo.id}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  dots: { position: 'absolute', start: 0, end: 0, flexDirection: 'row', justifyContent: 'center' },
  dot: { height: 8 },
});
