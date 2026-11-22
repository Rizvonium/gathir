/**
 * Single-product card image for quick WhatsApp replies (PLAN §6 "Product card image"):
 * a 1080×1350 JPEG with the photo, name, craft, rate and shop name inside a bazaar pattern frame.
 * Drawn with plain RN views (robust to capture on every Android device; Skia surfaces can come out
 * blank in view-shot) and captured offscreen with react-native-view-shot.
 *
 * Usage:
 *   const card = useProductCardCapture(data);
 *   return <>{card.node}<Button onPress={async () => share(await card.capture())} /></>;
 */
import { Image } from 'expo-image';
import { useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type HostInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { formatINR } from '@/lib/money';
import { initials } from '@/pdf/html';
import { hashSeed, mulberry32 } from '@/pdf/patterns';
import { fonts, palette } from '@/ui/tokens';

/** Output size in pixels (4:5, WhatsApp's best portrait ratio). */
export const PRODUCT_CARD_SIZE = { width: 1080, height: 1350 } as const;
/** Layout size in dp; captured at PRODUCT_CARD_SIZE regardless of screen density. */
const CARD_W = 360;
const CARD_H = 450;
const FRAME = 14;
const DIAMONDS_PER_ROW = 15;
/** Longest wait for the photo to decode before capturing anyway. */
const PHOTO_TIMEOUT_MS = 4000;

export type ProductCardData = {
  /** Stable key for the frame's colour pattern (product id). */
  seedKey: string;
  name: string;
  craft: string;
  material?: string;
  /** Null → "Ask for the rate". */
  ratePaise: number | null;
  shopName: string;
  code?: string;
  /** file:// URI of the full photo, or null for the initials medallion. */
  photoUri: string | null;
};

const FRAME_INKS = [palette.chinar, palette.saffron, palette.teal, palette.rose, palette.indigo];

function DiamondRow({ seed }: { seed: number }) {
  const rand = mulberry32(seed);
  return (
    <View style={styles.diamondRow}>
      {Array.from({ length: DIAMONDS_PER_ROW }, (_, i) => (
        <View
          key={i}
          style={[styles.diamond, { backgroundColor: i % 2 === 0 ? palette.ivory : FRAME_INKS[Math.floor(rand() * FRAME_INKS.length)] }]}
        />
      ))}
    </View>
  );
}

/** The card itself (360×450 dp). Mount it through useProductCardCapture to export it. */
export function ProductCardImage({ data, onPhotoSettled }: { data: ProductCardData; onPhotoSettled?: () => void }) {
  const { t } = useTranslation('catalogue');
  const seed = hashSeed(data.seedKey);
  const meta = [data.craft, data.material].filter((p) => p && p.trim()).join(' · ');
  const rate = data.ratePaise !== null ? formatINR(data.ratePaise) : t('share.card.rateOnRequest');

  return (
    <View style={styles.card} collapsable={false}>
      <DiamondRow seed={seed} />
      <View style={styles.inner}>
        <View style={styles.photo}>
          {data.photoUri ? (
            <Image
              source={{ uri: data.photoUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="none"
              onLoadEnd={onPhotoSettled}
              onError={onPhotoSettled}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.initials}>{initials(data.name)}</Text>
            </View>
          )}
          {data.code ? (
            <View style={styles.code}>
              <Text style={styles.codeText}>{t('share.card.code', { code: data.code })}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={2}>
            {data.name}
          </Text>
          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          <View style={styles.bottom}>
            <Text style={[styles.rate, data.ratePaise === null && styles.rateMissing]} numberOfLines={1}>
              {rate}
            </Text>
            <Text style={styles.shop} numberOfLines={1}>
              {data.shopName}
            </Text>
          </View>
        </View>
      </View>
      <DiamondRow seed={seed + 1} />
    </View>
  );
}

type Waiter = { promise: Promise<void>; resolve: () => void };

function makeWaiter(): Waiter {
  let resolve = () => {};
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * Mount `node` anywhere (it renders offscreen) and call `capture()` to get a file:// URI of a
 * 1080×1350 JPEG. `capture` waits for the photo to load (up to 4 s) before capturing.
 */
export function useProductCardCapture(data: ProductCardData): { node: ReactElement; capture: () => Promise<string> } {
  const ref = useRef<HostInstance>(null);
  // One waiter per photo: resolved when the image finished loading (or failed).
  const [waiter, setWaiter] = useState(() => ({ uri: data.photoUri, ...makeWaiter() }));
  let current = waiter;
  if (waiter.uri !== data.photoUri) {
    current = { uri: data.photoUri, ...makeWaiter() };
    setWaiter(current);
  }
  if (!data.photoUri) current.resolve();

  const node = (
    <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View ref={ref} collapsable={false}>
        <ProductCardImage data={data} onPhotoSettled={current.resolve} />
      </View>
    </View>
  );

  const capture = async (): Promise<string> => {
    await Promise.race([current.promise, new Promise<void>((r) => setTimeout(r, PHOTO_TIMEOUT_MS))]);
    return captureRef(ref, {
      format: 'jpg',
      quality: 0.9,
      width: PRODUCT_CARD_SIZE.width,
      height: PRODUCT_CARD_SIZE.height,
      result: 'tmpfile',
    });
  };

  return { node, capture };
}

const styles = StyleSheet.create({
  offscreen: { position: 'absolute', top: 0, start: -10000, width: CARD_W, height: CARD_H, opacity: 1 },
  card: { width: CARD_W, height: CARD_H, backgroundColor: palette.chinar, padding: FRAME / 2 },
  diamondRow: { height: FRAME, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  diamond: { width: 7, height: 7, transform: [{ rotate: '45deg' }] },
  inner: { flex: 1, backgroundColor: palette.ivory, borderRadius: 6, overflow: 'hidden', borderWidth: 2, borderColor: palette.saffron },
  photo: { height: 286, backgroundColor: palette.sand },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.display, fontSize: 64, lineHeight: 76, color: palette.chinar },
  code: { position: 'absolute', top: 10, start: 10, backgroundColor: palette.ivory, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  codeText: { fontFamily: fonts.bodySemi, fontSize: 11, lineHeight: 14, color: palette.walnut },
  text: { flex: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  name: { fontFamily: fonts.display, fontSize: 22, lineHeight: 27, color: palette.walnut },
  meta: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: palette.walnutMuted },
  bottom: { marginTop: 'auto', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  rate: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: palette.chinar, fontVariant: ['tabular-nums'] },
  rateMissing: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 20, color: palette.teal },
  shop: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16, color: palette.teal },
});
