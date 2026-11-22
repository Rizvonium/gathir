import { dominantColourHex, fitWithin, isThumbName, photoNames, THUMB_MAX_SIDE } from '@/lib/photos';

jest.mock('expo-file-system', () => require('@/lib/__tests__/fakeFileSystem'));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg', PNG: 'png' } }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@shopify/react-native-skia', () => ({ Skia: {}, ColorType: {}, AlphaType: {} }));

describe('fitWithin', () => {
  it('scales the longest side down, keeping aspect', () => {
    expect(fitWithin({ width: 4000, height: 3000 }, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin({ width: 3000, height: 4000 }, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin({ width: 1600, height: 900 }, THUMB_MAX_SIDE)).toEqual({ width: 400, height: 225 });
  });
  it('never scales up and never returns zero', () => {
    expect(fitWithin({ width: 300, height: 200 }, 1600)).toEqual({ width: 300, height: 200 });
    expect(fitWithin({ width: 10000, height: 1 }, 400)).toEqual({ width: 400, height: 1 });
  });
});

describe('photo names', () => {
  it('derives full and thumb names from one id', () => {
    expect(photoNames('abc')).toEqual({ fileName: 'abc.jpg', thumbName: 'abc.thumb.jpg' });
    expect(isThumbName('abc.thumb.jpg')).toBe(true);
    expect(isThumbName('abc.jpg')).toBe(false);
  });
});

function image(width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  }
  return data;
}

describe('dominantColourHex', () => {
  it('ignores the border and returns the main centre colour', () => {
    // White border (background), maroon centre with a few gold threads.
    const px = image(10, 10, (x, y) => {
      if (x < 2 || x > 7 || y < 2 || y > 7) return [255, 255, 255, 255];
      if (x === 4 && y === 4) return [212, 175, 55, 255];
      return [128, 0, 32, 255];
    });
    expect(dominantColourHex(px, 10, 10)).toBe('#800020');
  });
  it('skips transparent pixels and returns null when nothing is opaque', () => {
    expect(dominantColourHex(image(5, 5, () => [10, 20, 30, 0]), 5, 5)).toBeNull();
  });
});
