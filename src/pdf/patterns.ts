/**
 * Original, seeded SVG ornaments for PDFs (PLAN §9 "Pattern language", §11).
 * Pure TypeScript: the same seed and size always give the same SVG string, so a catalogue
 * re-rendered tomorrow looks identical. Designs are our own geometry (no copied shawl motifs).
 * Each generator stays well under 30 KB so a PDF can carry several.
 */
import { escapeHtml } from './html';
import { palette as tokens } from '@/ui/tokens';

export type PatternPalette = {
  /** Background / cut-out colour (inner details of motifs). */
  ground: string;
  /** Motif colours, used in order and by seeded choice. At least one. */
  inks: string[];
};

/** Ready palettes for the two catalogue styles and the owner report. */
export const patternPalettes = {
  bazaar: { ground: tokens.ivory, inks: [tokens.chinar, tokens.saffron, tokens.teal, tokens.rose, tokens.indigo] },
  ivory: { ground: tokens.white, inks: [tokens.walnut, tokens.walnutMuted, tokens.lowText] },
} as const satisfies Record<string, PatternPalette>;

/** mulberry32: tiny, fast, well-distributed seeded PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of a string → 32-bit seed (e.g. hashSeed(product.id)). */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Rounds to one decimal and drops a trailing ".0" to keep SVGs small. */
function n(value: number): string {
  const r = Math.round(value * 10) / 10;
  return Object.is(r, -0) ? '0' : String(r);
}

function pick<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length) % list.length];
}

function idPrefix(kind: string, seed: number): string {
  return `${kind}${(seed >>> 0).toString(36)}`;
}

function svgOpen(width: number, height: number, extra = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(width)} ${n(height)}" width="${n(width)}" height="${n(height)}" aria-hidden="true"${extra}>`;
}

/**
 * One boteh (paisley) in a 100-unit box centred on the origin, tip up and curling right.
 * Body is a fat teardrop; the tip hooks over into a small spiral.
 */
const BOTEH_OUTER =
  'M0 42C-31 42-40 12-30-10C-21-30 2-38 11-49C15-55 25-53 23-44C21-38 13-40 15-34C31-20 35 21 0 42Z';
/** Inner contour, drawn as a cut-out line in the ground colour. */
const BOTEH_INNER = 'M0 31C-20 31-27 10-20-6C-14-20 0-25 6-31C17-17 22 15 0 31Z';

function botehSymbol(id: string, ground: string): string {
  return (
    `<symbol id="${id}" viewBox="-50 -60 100 110" overflow="visible">` +
    `<path d="${BOTEH_OUTER}" fill="currentColor"/>` +
    `<path d="${BOTEH_INNER}" fill="none" stroke="${ground}" stroke-width="2.4"/>` +
    `<circle cx="-1" cy="12" r="5" fill="${ground}"/>` +
    `<circle cx="-1" cy="12" r="2.2" fill="currentColor"/>` +
    `</symbol>`
  );
}

/** Eight-petal rosette (kani-style corner flower) as a path group. */
function rosette(cx: number, cy: number, r: number, ink: string, accent: string, ground: string): string {
  let petals = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const px = cx + Math.cos(a) * r * 0.62;
    const py = cy + Math.sin(a) * r * 0.62;
    petals += `<ellipse cx="${n(px)}" cy="${n(py)}" rx="${n(r * 0.36)}" ry="${n(r * 0.17)}" transform="rotate(${n((a * 180) / Math.PI)} ${n(px)} ${n(py)})"/>`;
  }
  return (
    `<g fill="${ink}">${petals}</g>` +
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.34)}" fill="${accent}"/>` +
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.14)}" fill="${ground}"/>`
  );
}

export type BorderOptions = {
  seed: number;
  width: number;
  height: number;
  palette: PatternPalette;
  /** Band thickness; default 7% of the shorter side. */
  band?: number;
};

/**
 * A rectangular frame of boteh (paisley) motifs: double rule, paisleys marching around the band
 * in alternating directions, stitch dots between them and a rosette in each corner.
 * Use as an absolutely positioned layer over a page or cover.
 */
export function botehBorderSvg({ seed, width, height, palette, band }: BorderOptions): string {
  const rand = mulberry32(seed);
  const b = band ?? Math.min(width, height) * 0.07;
  const id = idPrefix('bt', seed);
  const ink0 = palette.inks[0];
  const accent = palette.inks[1 % palette.inks.length];
  const motif = b * 0.62; // rendered paisley height
  const step = b * 1.3;
  const parts: string[] = [];

  // Double rule framing the band.
  parts.push(
    `<rect x="${n(b * 0.08)}" y="${n(b * 0.08)}" width="${n(width - b * 0.16)}" height="${n(height - b * 0.16)}" fill="none" stroke="${ink0}" stroke-width="${n(Math.max(0.8, b * 0.035))}"/>`,
    `<rect x="${n(b * 0.92)}" y="${n(b * 0.92)}" width="${n(width - b * 1.84)}" height="${n(height - b * 1.84)}" fill="none" stroke="${ink0}" stroke-width="${n(Math.max(0.5, b * 0.018))}"/>`,
  );

  // Sides: [start x, start y, direction x, direction y, length, base rotation].
  const sides: [number, number, number, number, number, number][] = [
    [b, b / 2, 1, 0, width - 2 * b, 90],
    [width - b / 2, b, 0, 1, height - 2 * b, 180],
    [width - b, height - b / 2, -1, 0, width - 2 * b, 270],
    [b / 2, height - b, 0, -1, height - 2 * b, 0],
  ];
  const dots: string[] = [];
  for (const [sx, sy, dx, dy, length, base] of sides) {
    const count = Math.max(1, Math.floor(length / step));
    const gap = length / count;
    for (let i = 0; i < count; i++) {
      const t = gap * (i + 0.5);
      const x = sx + dx * t;
      const y = sy + dy * t;
      const flip = i % 2 === 0 ? 0 : 180;
      const jitter = (rand() - 0.5) * 16;
      const scale = 1 + (rand() - 0.5) * 0.12;
      const size = motif * scale;
      const color = pick(rand, palette.inks);
      parts.push(
        `<use href="#${id}" x="${n(-size / 2)}" y="${n(-size / 2)}" width="${n(size)}" height="${n(size)}" color="${color}" transform="translate(${n(x)} ${n(y)}) rotate(${n(base + flip + jitter)})"/>`,
      );
      if (i < count - 1) {
        dots.push(`<circle cx="${n(x + (dx * gap) / 2)}" cy="${n(y + (dy * gap) / 2)}" r="${n(b * 0.06)}"/>`);
      }
    }
  }
  parts.push(`<g fill="${accent}">${dots.join('')}</g>`);

  // Corner rosettes.
  for (const [cx, cy] of [
    [b / 2, b / 2],
    [width - b / 2, b / 2],
    [width - b / 2, height - b / 2],
    [b / 2, height - b / 2],
  ]) {
    parts.push(rosette(cx, cy, b * 0.42, pick(rand, palette.inks), accent, palette.ground));
  }

  return `${svgOpen(width, height)}<defs>${botehSymbol(id, palette.ground)}</defs>${parts.join('')}</svg>`;
}

export type VineOptions = { seed: number; width: number; height: number; palette: PatternPalette };

/** Catmull-Rom through points → smooth cubic Bézier path data. */
function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return '';
  let d = `M${n(points[0][0])} ${n(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${n(c1x)} ${n(c1y)} ${n(c2x)} ${n(c2y)} ${n(p2[0])} ${n(p2[1])}`;
  }
  return d;
}

/**
 * A horizontal sozni (needle-stitch) vine: a gently waving stem drawn as running stitches,
 * with almond leaves alternating above and below and small buds. Good as a divider band.
 */
export function sozniVineSvg({ seed, width, height, palette }: VineOptions): string {
  const rand = mulberry32(seed);
  const mid = height / 2;
  const amp = height * 0.18;
  const phase = rand() * Math.PI * 2;
  const freq = (Math.PI * 2) / Math.max(60, height * 3.2);
  const stemY = (x: number) => mid + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.3 + phase * 1.7) * amp * 0.25;

  const points: [number, number][] = [];
  const samples = Math.max(8, Math.round(width / 14));
  for (let i = 0; i <= samples; i++) {
    const x = (width * i) / samples;
    points.push([x, stemY(x)]);
  }
  const ink0 = palette.inks[0];
  const stroke = Math.max(0.6, height * 0.035);
  const parts: string[] = [
    `<path d="${smoothPath(points)}" fill="none" stroke="${ink0}" stroke-width="${n(stroke)}" stroke-linecap="round" stroke-dasharray="${n(stroke * 3.2)} ${n(stroke * 1.8)}"/>`,
  ];

  const leafLen = height * 0.36;
  const leafW = leafLen * 0.38;
  const spacing = Math.max(height * 0.62, 14);
  const leaves: string[] = [];
  let side = rand() < 0.5 ? -1 : 1;
  for (let x = spacing / 2; x < width - spacing / 3; x += spacing * (0.85 + rand() * 0.3)) {
    const y = stemY(x);
    const slope = (stemY(x + 1) - stemY(x - 1)) / 2;
    const tangent = (Math.atan(slope) * 180) / Math.PI;
    const angle = tangent + side * (48 + rand() * 18);
    const color = pick(rand, palette.inks);
    // Almond leaf from the stem outwards along +x, then rotated into place.
    leaves.push(
      `<path d="M0 0Q${n(leafLen * 0.5)} ${n(-leafW)} ${n(leafLen)} 0Q${n(leafLen * 0.5)} ${n(leafW)} 0 0Z" fill="${color}" transform="translate(${n(x)} ${n(y)}) rotate(${n(angle)})"/>`,
    );
    if (rand() < 0.35) {
      const by = y - side * height * 0.3;
      leaves.push(`<circle cx="${n(x + spacing * 0.35)}" cy="${n(by)}" r="${n(height * 0.05)}" fill="${pick(rand, palette.inks)}"/>`);
    }
    side = -side;
  }
  parts.push(leaves.join(''));
  return `${svgOpen(width, height, ' preserveAspectRatio="none"')}${parts.join('')}</svg>`;
}

export type CornerOptions = { seed: number; size: number; palette: PatternPalette };

/** One small diamond (rhombus) centred on (x, y) as compact path data. */
function diamond(x: number, y: number, r: number): string {
  return `M${n(x)} ${n(y - r)}l${n(r)} ${n(r)}l${n(-r)} ${n(r)}l${n(-r)} ${n(-r)}z`;
}

/**
 * A kani-weave corner: a triangular field of twill-stepped diamonds whose colour threads drift,
 * finished with a quarter rosette. Drawn for the top-start corner; rotate with CSS for others.
 */
export function kaniCornerSvg({ seed, size, palette }: CornerOptions): string {
  const rand = mulberry32(seed);
  const cells = 11;
  const cell = size / cells;
  const r = cell * 0.42;
  const threads = palette.inks.length;
  const byColour = new Map<string, string[]>();
  const drift = Math.floor(rand() * threads);
  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells - row; col++) {
      if (row + col < 2) continue; // leave room for the rosette
      // Twill: colour steps one thread per diagonal, with an occasional drifting thread.
      const shift = rand() < 0.12 ? 1 : 0;
      const color = palette.inks[(row + col + drift + shift) % threads];
      const d = diamond(col * cell + cell / 2, row * cell + cell / 2, r * (1 - (row + col) / (cells * 1.6)));
      const list = byColour.get(color) ?? [];
      list.push(d);
      byColour.set(color, list);
    }
  }
  const groups = [...byColour.entries()].map(([color, ds]) => `<path fill="${color}" d="${ds.join('')}"/>`).join('');
  const rose = rosette(cell * 0.9, cell * 0.9, cell * 1.1, palette.inks[0], palette.inks[1 % threads], palette.ground);
  const rule = `<path d="M${n(cell * 2.4)} ${n(size - cell * 0.3)}L${n(size - cell * 0.3)} ${n(cell * 2.4)}" stroke="${palette.inks[0]}" stroke-width="${n(Math.max(0.5, cell * 0.06))}" fill="none"/>`;
  return `${svgOpen(size, size)}${groups}${rule}${rose}</svg>`;
}

export type PlaceholderOptions = {
  seed: number;
  width: number;
  height: number;
  palette: PatternPalette;
  /** Up to two letters drawn in the centre medallion. Escaped here. */
  initials: string;
  /** CSS font-family for the initials. */
  fontFamily?: string;
};

/**
 * Photo placeholder for products without a photo: a soft kani twill field with the product's
 * initials in an ivory medallion, so a catalogue never shows an empty box.
 */
export function placeholderSvg({ seed, width, height, palette, initials, fontFamily }: PlaceholderOptions): string {
  const rand = mulberry32(seed);
  const cols = 9;
  const cell = width / cols;
  const rows = Math.ceil(height / cell);
  const threads = palette.inks.length;
  const offset = Math.floor(rand() * threads);
  const byColour = new Map<string, string[]>();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const color = palette.inks[(Math.floor((row + col * 2) / 2) + offset) % threads];
      const list = byColour.get(color) ?? [];
      list.push(diamond(col * cell + cell / 2, row * cell + cell / 2, cell * 0.36));
      byColour.set(color, list);
    }
  }
  const field = [...byColour.entries()]
    .map(([color, ds]) => `<path fill="${color}" fill-opacity="0.22" d="${ds.join('')}"/>`)
    .join('');
  const medallion = Math.min(width, height) * 0.24;
  const cx = width / 2;
  const cy = height / 2;
  const font = escapeHtml(fontFamily ?? 'serif');
  return (
    `${svgOpen(width, height, ' preserveAspectRatio="xMidYMid slice"')}` +
    `<rect width="${n(width)}" height="${n(height)}" fill="${palette.ground}"/>${field}` +
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(medallion)}" fill="${palette.ground}" stroke="${palette.inks[0]}" stroke-width="${n(Math.max(0.8, medallion * 0.03))}"/>` +
    `<text x="${n(cx)}" y="${n(cy)}" text-anchor="middle" dominant-baseline="central" font-family="${font}" font-weight="700" font-size="${n(medallion * 0.82)}" fill="${palette.inks[0]}">${escapeHtml(initials)}</text>` +
    `</svg>`
  );
}
