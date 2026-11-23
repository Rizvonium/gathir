/**
 * Android draws the notification small icon from its alpha channel only. Without an `icon` the
 * expo-notifications plugin falls back to the adaptive launcher icon, whose opaque background
 * turns into a blank filled square in the status bar.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { inflateSync } from 'zlib';

const root = join(__dirname, '..', '..', '..');
const appJson = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')) as { expo: { plugins: (string | [string, Record<string, unknown>])[] } };

function notificationsPlugin(): Record<string, unknown> {
  const entry = appJson.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-notifications');
  if (!Array.isArray(entry)) throw new Error('expo-notifications plugin is not configured');
  return entry[1];
}

/** Decodes an 8-bit RGBA, non-interlaced PNG into its pixels (enough for this one asset). */
function readRgbaPng(buf: Buffer): { width: number; height: number; pixels: Uint8Array } {
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  let off = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString('ascii');
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8]).toBe(8); // bit depth
      expect(data[9]).toBe(6); // RGBA
      expect(data[12]).toBe(0); // not interlaced
    } else if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const ul = x >= 4 && y > 0 ? pixels[(y - 1) * stride + x - 4] : 0;
      let pred = 0;
      if (filter === 1) pred = left;
      else if (filter === 2) pred = up;
      else if (filter === 3) pred = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - ul;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - ul);
        pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : ul;
      }
      pixels[y * stride + x] = (v + pred) & 0xff;
    }
  }
  return { width, height, pixels };
}

describe('notification small icon', () => {
  it('is set in the expo-notifications plugin', () => {
    expect(notificationsPlugin().icon).toBe('./assets/images/notification-icon.png');
  });

  it('is a 96 px white glyph on a transparent background', () => {
    const icon = String(notificationsPlugin().icon);
    const { width, height, pixels } = readRgbaPng(readFileSync(join(root, icon)));
    expect([width, height]).toEqual([96, 96]);
    let opaque = 0;
    let transparent = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const a = pixels[i + 3];
      if (a === 0) transparent++;
      if (a > 0) {
        opaque++;
        expect([pixels[i], pixels[i + 1], pixels[i + 2]]).toEqual([255, 255, 255]);
      }
    }
    // A real shape: neither empty nor a filled square.
    expect(opaque).toBeGreaterThan(96 * 96 * 0.1);
    expect(transparent).toBeGreaterThan(96 * 96 * 0.3);
  });
});
