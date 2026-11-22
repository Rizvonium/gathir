import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useTranslation } from 'react-i18next';

import { durations, easings, springs, timing } from '../motion';
import { useTheme } from '../theme';
import { touchTarget } from '../tokens';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import { PressableScale } from './PressableScale';
import { warmShadow } from './surface';
import { useReduceMotionEnabled } from './useReduceMotionEnabled';

export type ToastTone = 'neutral' | 'success' | 'danger';

export type ToastOptions = {
  message: string;
  /** e.g. "Undo". Shown as a button; tapping it runs onAction and closes the toast. */
  actionLabel?: string;
  onAction?: () => void;
  /** Auto-hide delay. Default 8000 ms (long enough to reach Undo). */
  durationMs?: number;
  tone?: ToastTone;
};

export type ToastApi = {
  /** Shows a toast (replacing any visible one) and returns its id. */
  show: (options: ToastOptions) => string;
  /** Hides the toast with this id, or whichever is visible when no id is given. */
  hide: (id?: string) => void;
};

type ActiveToast = ToastOptions & { id: string };

const ToastContext = createContext<ToastApi | null>(null);

/** Distance from the bottom safe edge: clears the native tab bar. */
const DEFAULT_BOTTOM_OFFSET = 88;
const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 800;

const toneIcon: Record<ToastTone, IconName | null> = { neutral: null, success: 'check-circle', danger: 'error-outline' };

export type ToastProviderProps = {
  children: ReactNode;
  /** Gap above the bottom safe area (default clears the tab bar). */
  bottomOffset?: number;
};

/**
 * Hosts one toast at a time above the tab bar. Put it inside AppThemeProvider. Toasts slide
 * up (fade when motion is reduced), auto-hide, can be swiped sideways or closed with a button,
 * and are announced by TalkBack. Main use: "Deleted · Undo".
 */
export function ToastProvider({ children, bottomOffset = DEFAULT_BOTTOM_OFFSET }: ToastProviderProps) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const counter = useRef(0);

  const [api] = useState<ToastApi>(() => ({
    show: (options) => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      setToast({ ...options, id });
      AccessibilityInfo.announceForAccessibility(options.actionLabel ? `${options.message}. ${options.actionLabel}` : options.message);
      return id;
    },
    hide: (id) => setToast((cur) => (cur && (id === undefined || cur.id === id) ? null : cur)),
  }));

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => api.hide(toast.id), toast.durationMs ?? 8000);
    return () => clearTimeout(timer);
  }, [toast, api]);

  return (
    <ToastContext value={api}>
      {children}
      {toast ? <ToastCard key={toast.id} toast={toast} bottomOffset={bottomOffset} onClose={() => api.hide(toast.id)} /> : null}
    </ToastContext>
  );
}

/** Access the toast API. Must be used under ToastProvider. */
export function useToast(): ToastApi {
  const api = use(ToastContext);
  if (!api) throw new Error('useToast must be used inside ToastProvider');
  return api;
}

function ToastCard({ toast, bottomOffset, onClose }: { toast: ActiveToast; bottomOffset: number; onClose: () => void }) {
  const { colors, space, radius, scheme } = useTheme();
  const { t } = useTranslation('ui');
  const insets = useSafeAreaInsets();
  const reduced = useReduceMotionEnabled();
  const translateX = useSharedValue(0);

  const pan = usePanGesture({
    activeOffsetX: [-12, 12],
    onUpdate: (e) => {
      'worklet';
      translateX.set(e.translationX);
    },
    onDeactivate: (e) => {
      'worklet';
      const flung = Math.abs(e.translationX) > DISMISS_DISTANCE || Math.abs(e.velocityX) > DISMISS_VELOCITY;
      if (!e.canceled && flung) {
        const direction = (e.translationX || e.velocityX) > 0 ? 1 : -1;
        translateX.set(
          withTiming(direction * 500, timing.standard, (finished) => {
            if (finished) scheduleOnRN(onClose);
          }),
        );
      } else {
        translateX.set(withSpring(0, { ...springs.snap, velocity: e.velocityX }));
      }
    },
  });

  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
    opacity: 1 - Math.min(0.6, Math.abs(translateX.get()) / 300),
  }));

  const entering = reduced
    ? FadeIn.duration(durations.chip).reduceMotion(ReduceMotion.Never)
    : FadeInDown.duration(durations.standard).easing(easings.out).reduceMotion(ReduceMotion.System);
  const fg = colors.bg;
  const icon = toneIcon[toast.tone ?? 'neutral'];

  const runAction = () => {
    toast.onAction?.();
    onClose();
  };

  return (
    <View pointerEvents="box-none" style={[styles.layer, { bottom: insets.bottom + bottomOffset, paddingHorizontal: space.lg }]}>
      <GestureDetector gesture={pan}>
        <Animated.View
          entering={entering}
          exiting={FadeOut.duration(durations.chip).reduceMotion(ReduceMotion.Never)}
          accessibilityLiveRegion="polite"
          style={[
            styles.card,
            {
              backgroundColor: colors.text,
              borderRadius: radius.md,
              paddingStart: space.lg,
              paddingEnd: space.xs,
              paddingVertical: space.xs,
              gap: space.sm,
            },
            warmShadow(scheme, 'overlay'),
            swipeStyle,
          ]}>
          {icon ? <Icon name={icon} size={20} color={fg} /> : null}
          <AppText variant="small" weight="medium" color={fg} style={styles.message}>
            {toast.message}
          </AppText>
          {toast.actionLabel && toast.onAction ? (
            <PressableScale
              onPress={runAction}
              haptic="light"
              accessibilityLabel={toast.actionLabel}
              style={[styles.action, { paddingHorizontal: space.md, borderRadius: radius.pill }]}>
              <AppText variant="small" weight="bold" color={fg}>
                {toast.actionLabel}
              </AppText>
            </PressableScale>
          ) : null}
          <IconButton icon="close" accessibilityLabel={t('toast.dismiss')} onPress={onClose} size={40} color={fg} style={styles.close} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', start: 0, end: 0 },
  card: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  message: { flex: 1, paddingVertical: 8 },
  action: { minHeight: touchTarget, justifyContent: 'center' },
  close: { opacity: 0.85 },
});
