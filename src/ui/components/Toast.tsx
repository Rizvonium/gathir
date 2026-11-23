import { createContext, use, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { useOverlayStore } from './overlayStore';
import { PressableScale } from './PressableScale';
import { warmShadow } from './surface';
import { useReduceMotionEnabled } from './useReduceMotionEnabled';

export type ToastTone = 'neutral' | 'success' | 'danger';

export type ToastOptions = {
  message: string;
  /** e.g. "Undo". Shown as a button; tapping it runs onAction and closes the toast. */
  actionLabel?: string;
  onAction?: () => void;
  /** A second action, e.g. "Send bill" beside "Undo". Shown before the main action; tapping it runs onSecondaryAction and closes the toast. */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
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
/** The current toast, for an outlet inside a sheet (see ToastOutlet). */
const ToastStateContext = createContext<{ toast: ActiveToast | null; hide: (id?: string) => void } | null>(null);

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
 *
 * Overlay rules (overlayStore): while the app lock is up the toast waits (not shown, timer
 * paused) and appears once unlocked, so nothing is tappable above the PIN pad and an Undo is not
 * lost behind it. While a sheet is open the toast is shown inside the top sheet (ToastOutlet),
 * because a sheet is a window above this layer.
 */
export function ToastProvider({ children, bottomOffset = DEFAULT_BOTTOM_OFFSET }: ToastProviderProps) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const counter = useRef(0);

  const locked = useOverlayStore((s) => s.locked);
  const sheetOpen = useOverlayStore((s) => s.sheets.length > 0);

  const [api] = useState<ToastApi>(() => ({
    show: (options) => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      setToast({ ...options, id });
      return id;
    },
    hide: (id) => setToast((cur) => (cur && (id === undefined || cur.id === id) ? null : cur)),
  }));

  // Announced and timed only while it can be seen: a toast raised behind the lock waits for it.
  useEffect(() => {
    if (!toast || locked) return;
    AccessibilityInfo.announceForAccessibility(toastAnnouncement(toast));
    const timer = setTimeout(() => api.hide(toast.id), toast.durationMs ?? 8000);
    return () => clearTimeout(timer);
  }, [toast, locked, api]);

  const state = useMemo(() => ({ toast, hide: api.hide }), [toast, api]);

  return (
    <ToastContext value={api}>
      <ToastStateContext value={state}>
        {children}
        {toast && !locked && !sheetOpen ? <ToastCard key={toast.id} toast={toast} bottomOffset={bottomOffset} onClose={() => api.hide(toast.id)} /> : null}
      </ToastStateContext>
    </ToastContext>
  );
}

/**
 * Where the toast shows while a sheet is open: inline at the bottom of the top sheet's content
 * (AppSheet renders it). Renders nothing outside a ToastProvider or while locked.
 */
export function ToastOutlet() {
  const state = use(ToastStateContext);
  const locked = useOverlayStore((s) => s.locked);
  if (!state?.toast || locked) return null;
  const { toast, hide } = state;
  return <ToastCard key={toast.id} toast={toast} bottomOffset={0} inline onClose={() => hide(toast.id)} />;
}

/** What TalkBack reads when a toast appears: the message, then its action labels. */
export function toastAnnouncement(options: ToastOptions): string {
  return [options.message, ...toastActions(options).map((a) => a.label)].join('. ');
}

type ToastAction = { key: 'secondary' | 'primary'; label: string; run: () => void };

/** The toast's buttons in display order (secondary first, main action last, nearest the thumb). */
export function toastActions(options: ToastOptions): ToastAction[] {
  const out: ToastAction[] = [];
  if (options.secondaryActionLabel && options.onSecondaryAction) {
    out.push({ key: 'secondary', label: options.secondaryActionLabel, run: options.onSecondaryAction });
  }
  if (options.actionLabel && options.onAction) out.push({ key: 'primary', label: options.actionLabel, run: options.onAction });
  return out;
}

/** Access the toast API. Must be used under ToastProvider. */
export function useToast(): ToastApi {
  const api = use(ToastContext);
  if (!api) throw new Error('useToast must be used inside ToastProvider');
  return api;
}

function ToastCard({ toast, bottomOffset, inline = false, onClose }: { toast: ActiveToast; bottomOffset: number; inline?: boolean; onClose: () => void }) {
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

  const actions = toastActions(toast);

  const card = (
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
      {actions.map((a) => (
        <PressableScale
          key={a.key}
          testID={`toast-action-${a.key}`}
          onPress={() => {
            a.run();
            onClose();
          }}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={a.label}
          style={[styles.action, { paddingHorizontal: actions.length > 1 ? space.sm : space.md, borderRadius: radius.pill }]}>
          <AppText variant="small" weight={a.key === 'primary' ? 'bold' : 'semibold'} color={fg}>
            {a.label}
          </AppText>
        </PressableScale>
      ))}
      <IconButton icon="close" accessibilityLabel={t('toast.dismiss')} onPress={onClose} size={40} color={fg} style={styles.close} />
    </Animated.View>
  );

  // Inside a sheet (its own window, outside the gesture root): no swipe, the close button stays.
  if (inline) return <View testID="toast-inline">{card}</View>;
  return (
    <View pointerEvents="box-none" style={[styles.layer, { bottom: insets.bottom + bottomOffset, paddingHorizontal: space.lg }]}>
      <GestureDetector gesture={pan}>{card}</GestureDetector>
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
