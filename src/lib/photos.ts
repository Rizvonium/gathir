/**
 * Product photos: pick (camera / gallery), save (resize + thumbnail into app storage),
 * delete, display URIs, and data URIs for PDFs.
 *
 * Sizes follow PLAN §8: longest side 1600 px JPEG 0.8, thumbnail 400 px JPEG 0.7.
 */
import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { photoFile, photosDir, thumbFile } from './files';
import { newId } from './ids';

export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_QUALITY = 0.8;
export const THUMB_MAX_SIDE = 400;
export const THUMB_QUALITY = 0.7;
/** PLAN §3: up to 8 photos per product. */
export const MAX_PHOTOS_PER_PRODUCT = 8;
export const THUMB_SUFFIX = '.thumb.jpg';

export type PickResult =
  | { status: 'ok'; uris: string[] }
  | { status: 'cancelled' }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'error'; message: string };

export type SavedPhoto = { fileName: string; thumbName: string; width: number; height: number };

export type Size = { width: number; height: number };

/** Scales `size` down so its longest side is at most `maxSide` (never scales up). Whole pixels. */
export function fitWithin(size: Size, maxSide: number): Size {
  const longest = Math.max(size.width, size.height);
  if (longest <= maxSide || longest <= 0) return { width: size.width, height: size.height };
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/** File names for a new photo id: `<id>.jpg` and `<id>.thumb.jpg`. */
export function photoNames(id: string): { fileName: string; thumbName: string } {
  return { fileName: `${id}.jpg`, thumbName: `${id}${THUMB_SUFFIX}` };
}

/** True for thumbnail file names (used to count photos without their thumbnails). */
export function isThumbName(name: string): boolean {
  return name.endsWith(THUMB_SUFFIX);
}

function toPickResult(result: ImagePicker.ImagePickerResult, max: number): PickResult {
  if (result.canceled || result.assets.length === 0) return { status: 'cancelled' };
  return { status: 'ok', uris: result.assets.slice(0, max).map((a) => a.uri) };
}

function errorResult(e: unknown): PickResult {
  return { status: 'error', message: e instanceof Error ? e.message : String(e) };
}

/** Opens the camera after asking for permission. Returns a temp URI to pass to `savePhoto`. */
export async function pickFromCamera(): Promise<PickResult> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { status: 'denied', canAskAgain: perm.canAskAgain };
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1, exif: false });
    return toPickResult(result, 1);
  } catch (e) {
    return errorResult(e);
  }
}

/**
 * Opens the Android photo picker (needs no storage permission). `max` caps the selection,
 * e.g. the photo slots left on a product.
 */
export async function pickFromGallery(
  opts: { multiple?: boolean; max?: number } = {},
): Promise<PickResult> {
  const multiple = opts.multiple ?? true;
  const max = Math.max(1, opts.max ?? MAX_PHOTOS_PER_PRODUCT);
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 1,
      exif: false,
      allowsMultipleSelection: multiple && max > 1,
      selectionLimit: multiple ? max : 1,
      orderedSelection: true,
    });
    return toPickResult(result, multiple ? max : 1);
  } catch (e) {
    return errorResult(e);
  }
}

/**
 * Recovers a camera/gallery result lost when Android killed the app while the picker was open
 * (common on low-memory phones). Call once when the add-photo screen mounts. Null if none.
 */
export async function recoverPendingPick(): Promise<PickResult | null> {
  try {
    const pending = await ImagePicker.getPendingResultAsync();
    if (!pending) return null;
    if ('code' in pending) return { status: 'error', message: pending.message };
    return toPickResult(pending, MAX_PHOTOS_PER_PRODUCT);
  } catch (e) {
    return errorResult(e);
  }
}

/** Decodes `source` (no larger than `maxSide`), resizes exactly to fit, and renders it. */
async function renderFitted(source: string | ImageRef, maxSide: number): Promise<ImageRef> {
  const loadOpts = typeof source === 'string' ? { maxWidth: maxSide, maxHeight: maxSide } : undefined;
  const ctx = ImageManipulator.manipulate(source, loadOpts);
  try {
    const decoded = await ctx.renderAsync();
    const target = fitWithin(decoded, maxSide);
    if (target.width === decoded.width && target.height === decoded.height) return decoded;
    const resizeCtx = ImageManipulator.manipulate(decoded).resize(target);
    try {
      return await resizeCtx.renderAsync();
    } finally {
      resizeCtx.release();
      decoded.release();
    }
  } finally {
    ctx.release();
  }
}

/** Saves `image` as JPEG and moves the temp file to `dest`. */
async function saveJpegTo(image: ImageRef, quality: number, dest: File): Promise<void> {
  const saved = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
  if (dest.exists) dest.delete();
  new File(saved.uri).moveSync(dest);
}

/**
 * Resizes a picked image to ≤1600 px (JPEG 0.8) plus a ≤400 px thumbnail (JPEG 0.7) and stores
 * both in the photos folder under fresh ids. Store the returned names in the `photos` table.
 * Throws if the image cannot be decoded or written; nothing is left behind on failure.
 */
export async function savePhoto(uri: string): Promise<SavedPhoto> {
  const names = photoNames(newId());
  photosDir();
  let full: ImageRef | null = null;
  let thumb: ImageRef | null = null;
  try {
    full = await renderFitted(uri, PHOTO_MAX_SIDE);
    await saveJpegTo(full, PHOTO_QUALITY, photoFile(names.fileName));
    thumb = await renderFitted(full, THUMB_MAX_SIDE);
    await saveJpegTo(thumb, THUMB_QUALITY, thumbFile(names.thumbName));
    return { ...names, width: full.width, height: full.height };
  } catch (e) {
    deletePhotoFiles([names.fileName, names.thumbName]);
    throw e;
  } finally {
    if (thumb && thumb !== full) thumb.release();
    full?.release();
  }
}

/** Deletes photo/thumbnail files by name. Missing or unsafe names are skipped. Returns the count deleted. */
export function deletePhotoFiles(names: readonly (string | null | undefined)[]): number {
  let deleted = 0;
  for (const name of names) {
    if (!name) continue;
    try {
      const file = photoFile(name);
      if (file.exists) {
        file.delete();
        deleted += 1;
      }
    } catch {
      // Unsafe name or file busy: skip.
    }
  }
  return deleted;
}

/** `file://` URI of a full-size photo, for `<Image source={{ uri }} />` (expo-image). */
export function photoUri(fileName: string): string {
  return photoFile(fileName).uri;
}

/** `file://` URI of a thumbnail, for lists and grids. */
export function thumbUri(thumbName: string): string {
  return thumbFile(thumbName).uri;
}

/**
 * A small JPEG of a stored photo as a `data:` URI for embedding in PDF HTML.
 * Returns null when the photo file is missing or cannot be decoded (render a placeholder).
 */
export async function photoAsDataUri(fileName: string, maxSide = 800, quality = 0.72): Promise<string | null> {
  let image: ImageRef | null = null;
  try {
    const source = photoFile(fileName);
    if (!source.exists) return null;
    image = await renderFitted(source.uri, maxSide);
    const saved = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
    const temp = new File(saved.uri);
    try {
      return `data:image/jpeg;base64,${await temp.base64()}`;
    } finally {
      if (temp.exists) temp.delete();
    }
  } catch {
    return null;
  } finally {
    image?.release();
  }
}

/** Side of the tiny image used for colour sampling. */
const SAMPLE_SIDE = 40;

/**
 * Dominant colour of RGBA pixels as `#rrggbb`, looking only at the central 60% (where the shawl is
 * usually framed). Pixels are bucketed at 4 bits per channel; the fullest bucket's mean wins.
 * Returns null when there are no opaque pixels.
 */
export function dominantColourHex(rgba: ArrayLike<number>, width: number, height: number): string | null {
  const x0 = Math.floor(width * 0.2);
  const x1 = Math.ceil(width * 0.8);
  const y0 = Math.floor(height * 0.2);
  const y1 = Math.ceil(height * 0.8);
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      if ((rgba[i + 3] ?? 0) < 128) continue;
      const r = rgba[i] ?? 0;
      const g = rgba[i + 1] ?? 0;
      const b = rgba[i + 2] ?? 0;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      bucket.n += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) if (!best || bucket.n > best.n) best = bucket;
  if (!best) return null;
  const hex = (v: number) => Math.round(v / best.n).toString(16).padStart(2, '0');
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
}

/**
 * Suggests a colour swatch (`#rrggbb`) from a stored photo or thumbnail, e.g. to prefill a new
 * colour's hex. Decodes a 40 px copy with Skia. Returns null if it cannot be read.
 */
export async function sampleColourFromImage(fileName: string): Promise<string | null> {
  let small: ImageRef | null = null;
  let temp: File | null = null;
  try {
    const source = photoFile(fileName);
    if (!source.exists) return null;
    small = await renderFitted(source.uri, SAMPLE_SIDE);
    const saved = await small.saveAsync({ format: SaveFormat.PNG });
    temp = new File(saved.uri);
    const skImage = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(await temp.bytes()));
    if (!skImage) return null;
    const width = skImage.width();
    const height = skImage.height();
    const pixels = skImage.readPixels(0, 0, {
      width,
      height,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    });
    skImage.dispose();
    if (!(pixels instanceof Uint8Array)) return null;
    return dominantColourHex(pixels, width, height);
  } catch {
    return null;
  } finally {
    small?.release();
    if (temp?.exists) temp.delete();
  }
}
