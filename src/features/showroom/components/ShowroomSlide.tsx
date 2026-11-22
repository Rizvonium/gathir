/**
 * One shawl, edge to edge. The active photo drifts slowly (Ken Burns, 8 s, static with reduced
 * motion); pinch or double-tap zooms in to see the weave (up to 4×, rubber band at the ends).
 * While zoomed, one finger pans and the pager is locked.
 */
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTranslation } from 'react-i18next';

import type { ProductListRow } from '@/db/repo/productQueries';
import { photoUri, thumbUri } from '@/lib/photos';
import { springs, timing } from '@/ui/motion';
import { PatternPlaceholder } from '@/ui/patterns';

import { clamp, DOUBLE_TAP_ZOOM, doubleTapOffset, focalOffset, KEN_BURNS_MS, kenBurnsPose, MAX_ZOOM, maxOffset, MIN_ZOOM, rubberBand } from '../logic/showroom';

export type ShowroomSlideProps = {
  product: ProductListRow;
  index: number;
  width: number;
  height: number;
  /** The slide on screen: only it drifts. */
  active: boolean;
  reducedMotion: boolean;
  onZoomChange: (zoomed: boolean) => void;
};

const DRIFT = { duration: KEN_BURNS_MS, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System };

export function ShowroomSlide({ product, index, width, height, active, reducedMotion, onZoomChange }: ShowroomSlideProps) {
  const { t } = useTranslation('showroom');
  const drift = useSharedValue(0);
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const start = useSharedValue({ scale: 1, tx: 0, ty: 0, fx: 0, fy: 0 });
  const panEnabled = useSharedValue(false);

  // Drift only on the visible slide; back to rest when it leaves or motion is reduced.
  useEffect(() => {
    if (active && !reducedMotion) {
      drift.set(0);
      drift.set(withRepeat(withTiming(1, DRIFT), -1, true));
    } else {
      cancelAnimation(drift);
      drift.set(withTiming(0, timing.standard));
    }
    if (!active) {
      scale.set(1);
      tx.set(0);
      ty.set(0);
      panEnabled.set(false);
    }
    return () => cancelAnimation(drift);
  }, [active, reducedMotion, drift, scale, tx, ty, panEnabled]);

  const settle = (target: number, x: number, y: number) => {
    'worklet';
    const s = clamp(target, MIN_ZOOM, MAX_ZOOM);
    const mx = maxOffset(width, s);
    const my = maxOffset(height, s);
    scale.set(withSpring(s, springs.snap));
    tx.set(withSpring(clamp(x, -mx, mx), springs.snap));
    ty.set(withSpring(clamp(y, -my, my), springs.snap));
    const zoomed = s > MIN_ZOOM + 0.01;
    panEnabled.set(zoomed);
    scheduleOnRN(onZoomChange, zoomed);
  };

  const pinch = usePinchGesture({
    onActivate: (e) => {
      'worklet';
      start.set({ scale: scale.get(), tx: tx.get(), ty: ty.get(), fx: e.focalX - width / 2, fy: e.focalY - height / 2 });
    },
    onUpdate: (e) => {
      'worklet';
      const s0 = start.get();
      const next = rubberBand(s0.scale * e.scale, MIN_ZOOM, MAX_ZOOM);
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
      tx.set(rubberBand(start.get().tx + e.translationX, -maxOffset(width, s), maxOffset(width, s)));
      ty.set(rubberBand(start.get().ty + e.translationY, -maxOffset(height, s), maxOffset(height, s)));
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
      if (scale.get() > MIN_ZOOM + 0.01) settle(MIN_ZOOM, 0, 0);
      else settle(DOUBLE_TAP_ZOOM, doubleTapOffset(e.x, width, DOUBLE_TAP_ZOOM), doubleTapOffset(e.y, height, DOUBLE_TAP_ZOOM));
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));
  const driftStyle = useAnimatedStyle(() => {
    const p = kenBurnsPose(index, width, height, drift.get());
    return { transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }] };
  });

  const zoomTo = (s: number) => {
    scale.set(withSpring(s, springs.snap));
    tx.set(withSpring(0, springs.snap));
    ty.set(withSpring(0, springs.snap));
    panEnabled.set(s > MIN_ZOOM);
    onZoomChange(s > MIN_ZOOM);
  };

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{ width, height, overflow: 'hidden' }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('photoOf', { name: product.name })}
        accessibilityHint={t('zoomHint')}
        accessibilityActions={[{ name: 'zoomIn' }, { name: 'zoomOut' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'zoomIn') zoomTo(DOUBLE_TAP_ZOOM);
          if (e.nativeEvent.actionName === 'zoomOut') zoomTo(MIN_ZOOM);
        }}>
        <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, driftStyle]}>
            {product.coverFile ? (
              <Image
                source={{ uri: photoUri(product.coverFile) }}
                placeholder={product.coverThumb ? { uri: thumbUri(product.coverThumb) } : undefined}
                placeholderContentFit="cover"
                contentFit="cover"
                transition={reducedMotion ? 0 : 200}
                recyclingKey={product.id}
                style={StyleSheet.absoluteFill}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <PatternPlaceholder productId={product.id} name={product.name} width={width} height={height} radius={0} />
            )}
          </Animated.View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
