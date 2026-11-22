import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTranslation } from 'react-i18next';

import { thumbUri } from '@/lib/photos';
import { AppSheet, AppText, IconButton, playHaptic, PressableScale, Thumbnail } from '@/ui/components';
import { springs, timing } from '@/ui/motion';
import { useTheme } from '@/ui/theme';

import type { DraftPhoto } from '../../logic/draft';
import { SheetOption } from '../SheetOption';

const COLUMNS = 3;

export type PhotoGridProps = {
  photos: DraftPhoto[];
  /** Grid width in dp (the parent measures it). */
  width: number;
  onMove: (from: number, to: number) => void;
  onRemove: (fileName: string) => void;
};

/** Index under a dragged tile's centre. */
export function slotAt(x: number, y: number, cell: number, gap: number, count: number): number {
  'worklet';
  const pitch = cell + gap;
  const col = Math.max(0, Math.min(COLUMNS - 1, Math.floor((x + cell / 2) / pitch)));
  const row = Math.max(0, Math.floor((y + cell / 2) / pitch));
  return Math.max(0, Math.min(count - 1, row * COLUMNS + col));
}

/**
 * Photos in a 3-column grid; the first is the cover. Hold a photo and drag it to a new place
 * (the slot under it lights up); tap a photo for the same moves as buttons (Make cover,
 * Move earlier/later, Remove), which TalkBack also gets as actions.
 */
export function PhotoGrid({ photos, width, onMove, onRemove }: PhotoGridProps) {
  const { space } = useTheme();
  const { t } = useTranslation('stock');
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const hover = useSharedValue(-1);
  const gap = space.sm;
  const cell = Math.floor((width - gap * (COLUMNS - 1)) / COLUMNS);
  const rows = Math.ceil(photos.length / COLUMNS);

  if (cell <= 0) return null;
  const menuPhoto = menuIndex !== null ? photos[menuIndex] : undefined;

  return (
    <View style={{ height: rows * cell + Math.max(0, rows - 1) * gap }}>
      {photos.map((p, i) => (
        <DraggableTile
          key={p.fileName}
          photo={p}
          index={i}
          count={photos.length}
          cell={cell}
          gap={gap}
          hover={hover}
          onMove={onMove}
          onRemove={onRemove}
          onOpenMenu={setMenuIndex}
        />
      ))}
      <AppSheet visible={menuPhoto !== undefined} onClose={() => setMenuIndex(null)}>
        {menuIndex !== null && menuPhoto ? (
          <View>
            <SheetOption
              icon="star-outline"
              label={t('wizard.photos.makeCover')}
              disabled={menuIndex === 0}
              onPress={() => {
                onMove(menuIndex, 0);
                setMenuIndex(null);
              }}
            />
            <SheetOption
              icon="arrow-back"
              label={t('wizard.photos.moveEarlier')}
              disabled={menuIndex === 0}
              onPress={() => {
                onMove(menuIndex, menuIndex - 1);
                setMenuIndex(null);
              }}
            />
            <SheetOption
              icon="arrow-forward"
              label={t('wizard.photos.moveLater')}
              disabled={menuIndex >= photos.length - 1}
              onPress={() => {
                onMove(menuIndex, menuIndex + 1);
                setMenuIndex(null);
              }}
            />
            <SheetOption
              icon="delete-outline"
              tone="danger"
              label={t('wizard.photos.remove')}
              onPress={() => {
                onRemove(menuPhoto.fileName);
                setMenuIndex(null);
              }}
            />
          </View>
        ) : null}
      </AppSheet>
    </View>
  );
}

type TileProps = {
  photo: DraftPhoto;
  index: number;
  count: number;
  cell: number;
  gap: number;
  hover: SharedValue<number>;
  onMove: (from: number, to: number) => void;
  onRemove: (fileName: string) => void;
  onOpenMenu: (index: number) => void;
};

function DraggableTile({ photo, index, count, cell, gap, hover, onMove, onRemove, onOpenMenu }: TileProps) {
  const { colors, space, radius } = useTheme();
  const { t } = useTranslation('stock');
  const x = (index % COLUMNS) * (cell + gap);
  const y = Math.floor(index / COLUMNS) * (cell + gap);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const lifted = useSharedValue(0);

  const drag = usePanGesture({
    activateAfterLongPress: 300,
    onActivate: () => {
      'worklet';
      lifted.set(withTiming(1, timing.press));
      hover.set(index);
      scheduleOnRN(playHaptic, 'light');
    },
    onUpdate: (e) => {
      'worklet';
      dx.set(e.translationX);
      dy.set(e.translationY);
      hover.set(slotAt(x + e.translationX, y + e.translationY, cell, gap, count));
    },
    onDeactivate: (e) => {
      'worklet';
      const target = slotAt(x + e.translationX, y + e.translationY, cell, gap, count);
      if (!e.canceled && target !== index) scheduleOnRN(onMove, index, target);
    },
    onFinalize: () => {
      'worklet';
      // Runs after success, cancel or failure: always settle back into the grid.
      dx.set(withSpring(0, springs.snap));
      dy.set(withSpring(0, springs.snap));
      lifted.set(withTiming(0, timing.press));
      hover.set(-1);
    },
  });

  const tileStyle = useAnimatedStyle(() => ({
    zIndex: lifted.get() > 0 ? 10 : 0,
    transform: [{ translateX: dx.get() }, { translateY: dy.get() }, { scale: 1 + lifted.get() * 0.06 }],
    opacity: 1 - lifted.get() * 0.1,
  }));
  const targetStyle = useAnimatedStyle(() => ({
    opacity: hover.get() === index && lifted.get() === 0 ? 1 : 0,
  }));

  const cover = index === 0;
  const label = cover ? t('wizard.photos.coverA11y', { total: count }) : t('wizard.photos.photoA11y', { index: index + 1, total: count });

  return (
    <Animated.View style={[styles.tile, { width: cell, height: cell, start: x, top: y }, tileStyle]}>
      <GestureDetector gesture={drag}>
        <PressableScale
          onPress={() => onOpenMenu(index)}
          accessibilityLabel={label}
          accessibilityHint={t('wizard.photos.dragHint')}
          accessibilityActions={[
            { name: 'cover', label: t('wizard.photos.makeCover') },
            { name: 'earlier', label: t('wizard.photos.moveEarlier') },
            { name: 'later', label: t('wizard.photos.moveLater') },
            { name: 'remove', label: t('wizard.photos.remove') },
          ]}
          onAccessibilityAction={(e) => {
            const a = e.nativeEvent.actionName;
            if (a === 'cover') onMove(index, 0);
            if (a === 'earlier') onMove(index, index - 1);
            if (a === 'later') onMove(index, index + 1);
            if (a === 'remove') onRemove(photo.fileName);
          }}
          style={styles.fill}>
          <Thumbnail uri={thumbUri(photo.thumbName)} size={cell} rounded="md" recyclingKey={photo.fileName} />
        </PressableScale>
      </GestureDetector>
      <Animated.View pointerEvents="none" style={[styles.target, { borderRadius: radius.md, borderColor: colors.primary }, targetStyle]} />
      {cover ? (
        <View pointerEvents="none" style={[styles.cover, { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: space.sm, bottom: space.xs, start: space.xs }]}>
          <AppText variant="caption" weight="bold" color={colors.onPrimary}>
            {t('wizard.photos.cover')}
          </AppText>
        </View>
      ) : null}
      <IconButton
        icon="close"
        size={32}
        variant="filled"
        accessibilityLabel={t('wizard.photos.remove')}
        onPress={() => onRemove(photo.fileName)}
        style={[styles.remove, { top: space.xs, end: space.xs }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: { position: 'absolute' },
  fill: { flex: 1 },
  target: { ...StyleSheet.absoluteFill, borderWidth: 3 },
  cover: { position: 'absolute', paddingVertical: 2 },
  remove: { position: 'absolute' },
});
