/**
 * Gathir pattern geometry ("Counted Thread"): pure, seeded maths shared by every Skia
 * pattern component. No React, no Skia, no Expo imports, so it runs in Node tests.
 *
 * This is a 1:1 TypeScript port of design/pattern-lab/geometry.js. Each export has the
 * same name, arguments and output as its twin, and geometry.node.test.ts asserts that
 * both produce identical path strings for the same seed. Change one, change the other.
 *
 * Shapes are returned as SVG path strings (Skia.Path.MakeFromSVGString / <Path path="">
 * read them directly). Functions marked 'worklet' are safe to call on the UI thread.
 */

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- types

/** A seeded random source returning floats in [0, 1). */
export type Rng = () => number;
/** 2D noise in about [-1, 1]. */
export type Noise2D = (x: number, y: number) => number;
export type Circle = { x: number; y: number; r: number };

export type BotehMotif = { outline: string; inner: string; dots: Circle[] };
export type BotehPlacement = { x: number; y: number; size: number; angle: number; curl: number; ink: number };
export type SozniVine = { stem: string; leaves: string; bud: Circle; ink: number };
export type LeafParticle = {
  x0: number;
  y0: number;
  size: number;
  rot0: number;
  spin: number;
  sway: number;
  phase: number;
  fall: number;
  ink: number;
};
export type ConfettiParticle = {
  angle: number;
  speed: number;
  spin: number;
  rot0: number;
  scale: number;
  ink: number;
  /** 0 = tiny boteh, 1 = round sequin. */
  kind: 0 | 1;
};
export type Pose = { x: number; y: number; rot: number; alpha: number };
export type LoomGeometry = { warp: string; weft: string; beams: string };
export type MarkThread = { path: string; lead: string; ink: number; delay: number };
export type GathirMark = { threads: MarkThread[]; dot: Circle; strokeWidth: number };

// ---------------------------------------------------------------- numbers

/** Round to 2 decimals for compact, platform-stable path strings (no "-0"). */
export function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  return (r === 0 ? 0 : r).toString();
}

function clamp01(v: number): number {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---------------------------------------------------------------- randomness

/** mulberry32: tiny, fast, well-distributed 32-bit PRNG. Same seed, same sequence. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit hash: turns a product id (or any text) into a seed. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// ---------------------------------------------------------------- noise

const GRADS: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071],
];

/** Seeded 2D gradient (Perlin-style) noise in about [-1, 1]. */
export function createNoise2D(seed: number): Noise2D {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const p: number[] = [];
  for (let i = 0; i < 256; i++) p.push(i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  const perm = new Array<number>(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const dot = (hash: number, x: number, y: number) => {
    const g = GRADS[hash & 7];
    return g[0] * x + g[1] * y;
  };
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];
    const u = fade(xf);
    const v = fade(yf);
    const x1 = lerp(dot(aa, xf, yf), dot(ba, xf - 1, yf), u);
    const x2 = lerp(dot(ab, xf, yf - 1), dot(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v) * 1.414;
  };
}

/** Fractal sum of octaves of a noise function, normalised to about [-1, 1]. */
export function fbm2D(noise: Noise2D, x: number, y: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Flow-field heading (radians) at a point: domain-warped fbm, `turns` half-turns of range. */
export function flowAngle(noise: Noise2D, x: number, y: number, scale: number, turns: number): number {
  const wx = x * scale;
  const wy = y * scale;
  const warp = noise(wx + 5.2, wy + 1.3) * 0.6;
  return fbm2D(noise, wx + warp, wy - warp, 3) * Math.PI * turns;
}

// ---------------------------------------------------------------- path helpers

type Transform = (x: number, y: number) => [number, number];

function transformer(cx: number, cy: number, size: number, angle: number): Transform {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return (x, y) => [cx + (x * c - y * s) * size, cy + (x * s + y * c) * size];
}

/** SVG path for a circle (two arcs). */
export function circlePath(x: number, y: number, r: number): string {
  return (
    'M' + fmt(x - r) + ' ' + fmt(y) +
    'a' + fmt(r) + ' ' + fmt(r) + ' 0 1 0 ' + fmt(2 * r) + ' 0' +
    'a' + fmt(r) + ' ' + fmt(r) + ' 0 1 0 ' + fmt(-2 * r) + ' 0Z'
  );
}

/** Smooth open path through points (quadratic midpoint spline). */
export function smoothPath(points: readonly (readonly [number, number])[]): string {
  if (points.length < 2) return '';
  let d = 'M' + fmt(points[0][0]) + ' ' + fmt(points[0][1]);
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i][0] + points[i + 1][0]) / 2;
    const my = (points[i][1] + points[i + 1][1]) / 2;
    d += 'Q' + fmt(points[i][0]) + ' ' + fmt(points[i][1]) + ' ' + fmt(mx) + ' ' + fmt(my);
  }
  const last = points[points.length - 1];
  return d + 'L' + fmt(last[0]) + ' ' + fmt(last[1]);
}

// ---------------------------------------------------------------- boteh (paisley)

/** Unit boteh outline as cubic segments; `curl` in [0, 1] swings the tip outward. */
function botehSegments(curl: number): number[][] {
  const tx = 0.5 + 0.45 * curl;
  const ty = -2.05 + 0.15 * curl;
  return [
    [-0.78, 1, -1.05, 0.42, -1, -0.05],
    [-0.95, -0.72, -0.42, -1.2, 0.12, -1.42],
    [0.45, -1.56, 0.55, -1.82, tx, ty],
    [tx + 0.28, ty + 0.12, tx + 0.22, ty + 0.5, tx - 0.05, ty + 0.62],
    [0.95, -1.0, 1.08, -0.45, 1.0, 0.05],
    [0.95, 0.62, 0.6, 1, 0, 1],
  ];
}

/** Closed boteh outline (bulb radius = size, tip rising ~2×size) as an SVG path. */
export function botehPath(cx: number, cy: number, size: number, angle: number, curl: number): string {
  const T = transformer(cx, cy, size, angle);
  const start = T(0, 1);
  let d = 'M' + fmt(start[0]) + ' ' + fmt(start[1]);
  for (const s of botehSegments(curl)) {
    const a = T(s[0], s[1]);
    const b = T(s[2], s[3]);
    const c = T(s[4], s[5]);
    d += 'C' + fmt(a[0]) + ' ' + fmt(a[1]) + ' ' + fmt(b[0]) + ' ' + fmt(b[1]) + ' ' + fmt(c[0]) + ' ' + fmt(c[1]);
  }
  return d + 'Z';
}

/** Full boteh motif: outline, a nested inner boteh, and a ring of seed dots. */
export function botehMotif(cx: number, cy: number, size: number, angle: number, curl: number): BotehMotif {
  const T = transformer(cx, cy, size, angle);
  const innerCentre = T(0.02, 0.18);
  const dots: Circle[] = [];
  const count = 7;
  for (let k = 0; k < count; k++) {
    const a = lerp(0.62, 2.95, k / (count - 1)) + Math.PI * 0.5;
    const p = T(Math.cos(a) * 1.32, Math.sin(a) * 1.32);
    dots.push({ x: p[0], y: p[1], r: size * (0.07 + 0.04 * Math.sin((k / (count - 1)) * Math.PI)) });
  }
  return {
    outline: botehPath(cx, cy, size, angle, curl),
    inner: botehPath(innerCentre[0], innerCentre[1], size * 0.48, angle, curl),
    dots,
  };
}

/** Boteh placements along a flow field (dart throwing, x wraps so a band can tile). */
export function botehField(
  seed: number,
  width: number,
  height: number,
  density: number,
  inkCount: number,
): BotehPlacement[] {
  const rand = mulberry32(seed);
  const noise = createNoise2D(seed);
  const spacing = Math.sqrt((width * height) / (5 + 40 * clamp01(density)));
  const minDist = spacing * 0.92;
  const target = Math.round((width * height) / (spacing * spacing));
  const out: BotehPlacement[] = [];
  const attempts = target * 30;
  for (let n = 0; n < attempts && out.length < target; n++) {
    const x = rand() * width;
    const y = rand() * height;
    let ok = true;
    for (const o of out) {
      let dx = Math.abs(o.x - x);
      dx = Math.min(dx, width - dx);
      const dy = o.y - y;
      if (dx * dx + dy * dy < minDist * minDist) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    out.push({
      x,
      y,
      size: spacing * 0.2 * (0.8 + 0.45 * rand()),
      angle: flowAngle(noise, x, y, 1.6 / spacing, 1.2) + 0.5,
      curl: rand(),
      ink: Math.floor(rand() * inkCount),
    });
  }
  return out;
}

// ---------------------------------------------------------------- kani weave

/** Thread colour index for a warp (axis 0) / weft (axis 1) thread: ground 0, accents drift. */
export function threadInk(noise: Noise2D, index: number, axis: number, inkCount: number, accent: number): number {
  const v = noise(index * 0.23 + axis * 37.7, axis * 11.3 + 0.5);
  if (inkCount < 2 || v < 1 - 2 * accent) return 0;
  const band = (v + 1) * 0.5;
  return 1 + (Math.floor(band * 97 + index * 0.05) % (inkCount - 1));
}

/** 2/2 twill weave: one combined SVG path per ink (array index = ink). */
export function weaveLayers(
  seed: number,
  width: number,
  height: number,
  cell: number,
  inkCount: number,
  accent: number,
): string[] {
  const noise = createNoise2D(seed);
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const paths: string[] = [];
  for (let k = 0; k < inkCount; k++) paths.push('');
  const warpInk: number[] = [];
  const weftInk: number[] = [];
  for (let k = 0; k < cols; k++) warpInk.push(threadInk(noise, k, 0, inkCount, accent));
  for (let k = 0; k < rows; k++) weftInk.push(threadInk(noise, k, 1, inkCount, accent));
  const gap = Math.max(0.6, cell * 0.14);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const warpOnTop = (i + j) % 4 < 2;
      const x = i * cell;
      const y = j * cell;
      if (warpOnTop) {
        paths[warpInk[i]] +=
          'M' + fmt(x + gap) + ' ' + fmt(y) + 'h' + fmt(cell - 2 * gap) + 'v' + fmt(cell) + 'h' + fmt(-(cell - 2 * gap)) + 'Z';
      } else {
        paths[weftInk[j]] +=
          'M' + fmt(x) + ' ' + fmt(y + gap) + 'h' + fmt(cell) + 'v' + fmt(cell - 2 * gap) + 'h' + fmt(-cell) + 'Z';
      }
    }
  }
  return paths;
}

// ---------------------------------------------------------------- sozni vine

/** Almond leaflet: base at (x, y), pointing along `angle`, length `len`. */
export function leafletPath(x: number, y: number, angle: number, len: number): string {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const tipX = x + c * len;
  const tipY = y + s * len;
  const w = len * 0.38;
  const mx = x + c * len * 0.5;
  const my = y + s * len * 0.5;
  return (
    'M' + fmt(x) + ' ' + fmt(y) +
    'Q' + fmt(mx - s * w) + ' ' + fmt(my + c * w) + ' ' + fmt(tipX) + ' ' + fmt(tipY) +
    'Q' + fmt(mx + s * w) + ' ' + fmt(my - c * w) + ' ' + fmt(x) + ' ' + fmt(y) + 'Z'
  );
}

/** Needle-stitch vines travelling left to right through a flow field. */
export function sozniVines(
  seed: number,
  width: number,
  height: number,
  count: number,
  density: number,
  inkCount: number,
): SozniVine[] {
  const rand = mulberry32(seed + 101);
  const noise = createNoise2D(seed + 7);
  const step = Math.max(4, height * 0.045);
  const steps = Math.ceil((width * 1.15) / step);
  const leafEvery = Math.max(2, Math.round(lerp(6, 2, clamp01(density))));
  const vines: SozniVine[] = [];
  for (let v = 0; v < count; v++) {
    let x = -step;
    let y = height * lerp(0.15, 0.85, (v + 0.2 + rand() * 0.6) / count);
    const home = y;
    const pts: [number, number][] = [[x, y]];
    let leaves = '';
    let side = rand() < 0.5 ? 1 : -1;
    for (let i = 0; i < steps; i++) {
      let a = flowAngle(noise, x, y, 2.2 / height, 0.45);
      // Keep vines heading right, pull gently back toward the vine's own lane.
      const pull = ((home - y) / height) * 1.4;
      a = a * 0.8 + pull;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      pts.push([x, y]);
      if (i > 0 && i % leafEvery === 0) {
        const la = a + side * (0.9 + rand() * 0.35);
        leaves += leafletPath(x, y, la, step * (1.0 + rand() * 0.5));
        side = -side;
      }
    }
    const last = pts[pts.length - 1];
    vines.push({
      stem: smoothPath(pts),
      leaves,
      bud: { x: last[0], y: last[1], r: step * 0.45 },
      ink: (v % Math.max(1, inkCount - 1)) + 1,
    });
  }
  return vines;
}

// ---------------------------------------------------------------- chinar leaf

/** Radius of the five-lobed chinar outline at polar angle phi (0 = up). */
function chinarRadius(phi: number): number {
  // 1 - |sin|^0.8 gives broad lobes with pointed tips (a cusp at each peak).
  const lobes = 1 - Math.pow(Math.abs(Math.sin(phi * 2.5)), 0.8);
  const taper = 0.35 + 0.65 * Math.sqrt((1 + Math.cos(phi)) / 2);
  return (0.55 + 0.45 * lobes) * taper;
}

/** Chinar leaf outline centred near the origin, pointing up (stem at the bottom). */
export function chinarLeafPath(size: number): string {
  const n = 90;
  let d = '';
  for (let i = 0; i < n; i++) {
    const phi = -Math.PI + (i / n) * TAU;
    const r = chinarRadius(phi) * size;
    const x = Math.sin(phi) * r;
    const y = -Math.cos(phi) * r + size * 0.15;
    d += (i === 0 ? 'M' : 'L') + fmt(x) + ' ' + fmt(y);
  }
  return d + 'Z';
}

/** Stem and the five main veins of a chinar leaf of the same size. */
export function chinarVeinPath(size: number): string {
  const bx = 0;
  const by = size * 0.15;
  let d = 'M' + fmt(bx) + ' ' + fmt(by + size * 0.42) + 'L' + fmt(bx) + ' ' + fmt(by);
  for (const peak of [0, 0.4, -0.4, 0.8, -0.8]) {
    const phi = peak * Math.PI;
    const r = chinarRadius(phi) * size * 0.82;
    d += 'M' + fmt(bx) + ' ' + fmt(by) + 'L' + fmt(Math.sin(phi) * r) + ' ' + fmt(-Math.cos(phi) * r + by);
  }
  return d;
}

/** Up to 3 drifting leaves for the sale celebration. */
export function leafDrift(seed: number, count: number, width: number, height: number): LeafParticle[] {
  const rand = mulberry32(seed + 31);
  const n = Math.min(3, Math.max(0, count));
  const out: LeafParticle[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x0: width * lerp(0.2, 0.8, (i + 0.5) / n) + (rand() - 0.5) * width * 0.12,
      y0: -height * 0.05 + rand() * height * 0.15,
      size: Math.min(width, height) * (0.09 + rand() * 0.04),
      rot0: (rand() - 0.5) * 1.2,
      spin: (rand() - 0.5) * 2.4,
      sway: width * (0.04 + rand() * 0.05),
      phase: rand() * TAU,
      fall: height * (0.45 + rand() * 0.25),
      ink: i % 2,
    });
  }
  return out;
}

/** Pose of a drifting leaf at normalised time t in [0, 1]. UI-thread safe. */
export function leafPose(p: LeafParticle, t: number): Pose {
  'worklet';
  const tt = clamp01(t);
  const alpha = tt < 0.15 ? tt / 0.15 : tt > 0.72 ? 1 - (tt - 0.72) / 0.28 : 1;
  return {
    x: p.x0 + p.sway * Math.sin(p.phase + tt * TAU * 0.8),
    y: p.y0 + p.fall * (tt * (2 - tt) * 0.6 + tt * 0.4),
    rot: p.rot0 + p.spin * tt + 0.35 * Math.sin(p.phase + tt * TAU),
    alpha: clamp01(alpha),
  };
}

// ---------------------------------------------------------------- paisley confetti

/** Burst particles (max 40). */
export function confettiParticles(seed: number, count: number): ConfettiParticle[] {
  const rand = mulberry32(seed + 53);
  const n = Math.min(40, Math.max(0, count));
  const out: ConfettiParticle[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      angle: -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.25,
      speed: 0.55 + rand() * 0.6,
      spin: (rand() - 0.5) * 9,
      rot0: rand() * TAU,
      scale: 0.6 + rand() * 0.7,
      ink: i % 5,
      kind: rand() < 0.65 ? 0 : 1,
    });
  }
  return out;
}

/** Particle pose at t in [0, 1] for a burst from (ox, oy); `reach` = burst radius. UI-thread safe. */
export function confettiPose(p: ConfettiParticle, t: number, ox: number, oy: number, reach: number): Pose {
  'worklet';
  const tt = clamp01(t);
  const secs = tt * 1.2;
  const d = (p.speed * reach * (1 - Math.exp(-3.2 * secs))) / (1 - Math.exp(-3.2 * 1.2));
  const gravity = reach * 0.9;
  return {
    x: ox + Math.cos(p.angle) * d,
    y: oy + Math.sin(p.angle) * d + 0.5 * gravity * secs * secs,
    rot: p.rot0 + p.spin * secs,
    alpha: tt < 0.7 ? 1 : 1 - (tt - 0.7) / 0.3,
  };
}

// ---------------------------------------------------------------- loom

/** Loom for the empty-stock state: warp lines, serpentine over/under weft, two beams. */
export function loomGeometry(width: number, height: number, warpCount: number, rows: number): LoomGeometry {
  const padX = width * 0.12;
  const top = height * 0.16;
  const bottom = height * 0.84;
  const span = width - padX * 2;
  const gapX = span / (warpCount - 1);
  let warp = '';
  for (let i = 0; i < warpCount; i++) {
    const x = padX + i * gapX;
    warp += 'M' + fmt(x) + ' ' + fmt(top) + 'L' + fmt(x) + ' ' + fmt(bottom);
  }
  const beams =
    'M' + fmt(padX - gapX * 0.6) + ' ' + fmt(top) + 'L' + fmt(width - padX + gapX * 0.6) + ' ' + fmt(top) +
    'M' + fmt(padX - gapX * 0.6) + ' ' + fmt(bottom) + 'L' + fmt(width - padX + gapX * 0.6) + ' ' + fmt(bottom);
  const rowH = (bottom - top) / (rows + 1);
  const amp = Math.min(rowH * 0.22, 2.5);
  let weft = '';
  for (let r = 0; r < rows; r++) {
    const y = bottom - (r + 1) * rowH;
    const ltr = r % 2 === 0;
    for (let i = 0; i < warpCount; i++) {
      const idx = ltr ? i : warpCount - 1 - i;
      const wx = padX + idx * gapX;
      const wy = y + ((idx + r) % 2 === 0 ? -amp : amp);
      if (r === 0 && i === 0) weft += 'M' + fmt(wx) + ' ' + fmt(wy);
      else weft += 'L' + fmt(wx) + ' ' + fmt(wy);
    }
    if (r < rows - 1) {
      // Turn around the selvedge to the next row up.
      const edge = ltr ? width - padX + gapX * 0.35 : padX - gapX * 0.35;
      weft += 'Q' + fmt(edge) + ' ' + fmt(y - rowH * 0.5) + ' ' + fmt(ltr ? width - padX : padX) + ' ' + fmt(y - rowH);
    }
  }
  return { warp, weft, beams };
}

// ---------------------------------------------------------------- Gathir mark

/**
 * The Gathir paisley mark in a square of side `box`: three nested boteh threads (ink 0,
 * 1, 2) and a seed dot (ink 3). `lead` is each thread's straight entry line, used only by
 * the first-launch weave. fill in (0, 1] = share of the box the mark may occupy.
 */
export function gathirMark(box: number, fill: number): GathirMark {
  const unit = (box * fill) / 3.2;
  const angle = -0.32;
  const cx = box * 0.5 - unit * 0.05;
  const cy = box * 0.5 + unit * 0.62;
  const scales = [1, 0.7, 0.42];
  const threads: MarkThread[] = [];
  for (let k = 0; k < scales.length; k++) {
    const s = unit * scales[k];
    const T = transformer(cx, cy + unit * (1 - scales[k]) * 0.55, s, angle);
    const start = T(0, 1);
    const fromLeft = k % 2 === 0;
    const leadY = start[1] + (k - 1) * unit * 0.12;
    threads.push({
      path: botehPath(cx, cy + unit * (1 - scales[k]) * 0.55, s, angle, 0.62),
      lead: 'M' + fmt(fromLeft ? -box * 0.1 : box * 1.1) + ' ' + fmt(leadY) + 'L' + fmt(start[0]) + ' ' + fmt(start[1]),
      ink: k,
      delay: k * 0.12,
    });
  }
  const dotCentre = transformer(cx, cy + unit * 0.32, unit, angle)(0, 0.12);
  return { threads, dot: { x: dotCentre[0], y: dotCentre[1], r: unit * 0.13 }, strokeWidth: unit * 0.16 };
}
