/*
 * Gathir pattern geometry: the single source of the "Counted Thread" maths.
 *
 * This file is the design-time twin of src/ui/patterns/geometry.ts. Every exported
 * function here has an identically named, identically behaving export there; the Jest
 * test src/ui/patterns/__tests__/geometry.node.test.ts loads BOTH and asserts that the
 * same seed produces byte-identical SVG path strings. Change one, change the other.
 *
 * Why UMD and not an ES module: the Pattern Lab must open straight from disk
 * (file://), where browsers block <script type="module">. The wrapper below makes the
 * file work as a classic <script> (window.GathirGeometry) AND via require() in Node.
 *
 * No p5 calls in here: geometry only uses its own seeded PRNG and noise so that the
 * phone (Skia) and the lab (p5) draw exactly the same art for the same seed.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GathirGeometry = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TAU = Math.PI * 2;

  // ---------------------------------------------------------------- numbers

  /** Round to 2 decimals for compact, platform-stable path strings (no "-0"). */
  function fmt(n) {
    var r = Math.round(n * 100) / 100;
    return (r === 0 ? 0 : r).toString();
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // ---------------------------------------------------------------- randomness

  /** mulberry32: tiny, fast, well-distributed 32-bit PRNG. Returns floats in [0, 1). */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** FNV-1a 32-bit hash: turns a product id (or any text) into a seed. */
  function hashString(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  // ---------------------------------------------------------------- noise

  var GRADS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071],
  ];

  /** Seeded 2D gradient (Perlin-style) noise. Returns a function (x, y) => [-1, 1]. */
  function createNoise2D(seed) {
    var rand = mulberry32(seed ^ 0x9e3779b9);
    var p = [];
    var i;
    for (i = 0; i < 256; i++) p.push(i);
    for (i = 255; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    var perm = new Array(512);
    for (i = 0; i < 512; i++) perm[i] = p[i & 255];

    function fade(t) {
      return t * t * t * (t * (t * 6 - 15) + 10);
    }
    function dot(hash, x, y) {
      var g = GRADS[hash & 7];
      return g[0] * x + g[1] * y;
    }
    return function (x, y) {
      var xi = Math.floor(x);
      var yi = Math.floor(y);
      var xf = x - xi;
      var yf = y - yi;
      var X = xi & 255;
      var Y = yi & 255;
      var aa = perm[perm[X] + Y];
      var ab = perm[perm[X] + Y + 1];
      var ba = perm[perm[X + 1] + Y];
      var bb = perm[perm[X + 1] + Y + 1];
      var u = fade(xf);
      var v = fade(yf);
      var x1 = lerp(dot(aa, xf, yf), dot(ba, xf - 1, yf), u);
      var x2 = lerp(dot(ab, xf, yf - 1), dot(bb, xf - 1, yf - 1), u);
      return lerp(x1, x2, v) * 1.414;
    };
  }

  /** Fractal sum of octaves of a noise function, normalised to about [-1, 1]. */
  function fbm2D(noise, x, y, octaves) {
    var sum = 0;
    var amp = 1;
    var freq = 1;
    var norm = 0;
    for (var o = 0; o < octaves; o++) {
      sum += noise(x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }

  /** Flow-field heading (radians) at a point: domain-warped fbm, `turns` half-turns of range. */
  function flowAngle(noise, x, y, scale, turns) {
    var wx = x * scale;
    var wy = y * scale;
    var warp = noise(wx + 5.2, wy + 1.3) * 0.6;
    return fbm2D(noise, wx + warp, wy - warp, 3) * Math.PI * turns;
  }

  // ---------------------------------------------------------------- path helpers

  function transformer(cx, cy, size, angle) {
    var c = Math.cos(angle);
    var s = Math.sin(angle);
    return function (x, y) {
      return [cx + (x * c - y * s) * size, cy + (x * s + y * c) * size];
    };
  }

  /** SVG path for a circle (two arcs), usable by Skia.Path.MakeFromSVGString. */
  function circlePath(x, y, r) {
    return (
      'M' + fmt(x - r) + ' ' + fmt(y) +
      'a' + fmt(r) + ' ' + fmt(r) + ' 0 1 0 ' + fmt(2 * r) + ' 0' +
      'a' + fmt(r) + ' ' + fmt(r) + ' 0 1 0 ' + fmt(-2 * r) + ' 0Z'
    );
  }

  /** Smooth open path through points (quadratic midpoint spline). */
  function smoothPath(points) {
    if (points.length < 2) return '';
    var d = 'M' + fmt(points[0][0]) + ' ' + fmt(points[0][1]);
    for (var i = 1; i < points.length - 1; i++) {
      var mx = (points[i][0] + points[i + 1][0]) / 2;
      var my = (points[i][1] + points[i + 1][1]) / 2;
      d += 'Q' + fmt(points[i][0]) + ' ' + fmt(points[i][1]) + ' ' + fmt(mx) + ' ' + fmt(my);
    }
    var last = points[points.length - 1];
    return d + 'L' + fmt(last[0]) + ' ' + fmt(last[1]);
  }

  // ---------------------------------------------------------------- boteh (paisley)

  /**
   * Unit boteh outline as cubic segments. Bulb of radius ~1 around the origin, tip rising
   * to the upper right and hooking back inward. `curl` in [0, 1] swings the tip outward.
   */
  function botehSegments(curl) {
    var tx = 0.5 + 0.45 * curl;
    var ty = -2.05 + 0.15 * curl;
    return [
      [-0.78, 1, -1.05, 0.42, -1, -0.05],
      [-0.95, -0.72, -0.42, -1.2, 0.12, -1.42],
      [0.45, -1.56, 0.55, -1.82, tx, ty],
      [tx + 0.28, ty + 0.12, tx + 0.22, ty + 0.5, tx - 0.05, ty + 0.62],
      [0.95, -1.0, 1.08, -0.45, 1.0, 0.05],
      [0.95, 0.62, 0.6, 1, 0, 1],
    ];
  }

  /** Closed boteh outline as an SVG path string (start at the bottom of the bulb). */
  function botehPath(cx, cy, size, angle, curl) {
    var T = transformer(cx, cy, size, angle);
    var start = T(0, 1);
    var d = 'M' + fmt(start[0]) + ' ' + fmt(start[1]);
    var segs = botehSegments(curl);
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      var a = T(s[0], s[1]);
      var b = T(s[2], s[3]);
      var c = T(s[4], s[5]);
      d += 'C' + fmt(a[0]) + ' ' + fmt(a[1]) + ' ' + fmt(b[0]) + ' ' + fmt(b[1]) + ' ' + fmt(c[0]) + ' ' + fmt(c[1]);
    }
    return d + 'Z';
  }

  /**
   * A full boteh motif: outline, a nested inner boteh, and a ring of seed dots along the
   * bulb ("counted" like stitches). Everything is in canvas coordinates.
   */
  function botehMotif(cx, cy, size, angle, curl) {
    var T = transformer(cx, cy, size, angle);
    var innerCentre = T(0.02, 0.18);
    var dots = [];
    var count = 7;
    for (var k = 0; k < count; k++) {
      var a = lerp(0.62, 2.95, k / (count - 1)) + Math.PI * 0.5;
      var p = T(Math.cos(a) * 1.32, Math.sin(a) * 1.32);
      dots.push({ x: p[0], y: p[1], r: size * (0.07 + 0.04 * Math.sin((k / (count - 1)) * Math.PI)) });
    }
    return {
      outline: botehPath(cx, cy, size, angle, curl),
      inner: botehPath(innerCentre[0], innerCentre[1], size * 0.48, angle, curl),
      dots: dots,
    };
  }

  /**
   * Boteh placements along a flow field (dart throwing with x-wrap so a band can tile).
   * density in [0, 1]. Each placement: { x, y, size, angle, curl, ink }.
   */
  function botehField(seed, width, height, density, inkCount) {
    var rand = mulberry32(seed);
    var noise = createNoise2D(seed);
    var spacing = Math.sqrt((width * height) / (5 + 40 * clamp01(density)));
    var minDist = spacing * 0.92;
    var target = Math.round((width * height) / (spacing * spacing));
    var out = [];
    var attempts = target * 30;
    for (var n = 0; n < attempts && out.length < target; n++) {
      var x = rand() * width;
      var y = rand() * height;
      var ok = true;
      for (var i = 0; i < out.length; i++) {
        var dx = Math.abs(out[i].x - x);
        dx = Math.min(dx, width - dx);
        var dy = out[i].y - y;
        if (dx * dx + dy * dy < minDist * minDist) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      out.push({
        x: x,
        y: y,
        size: spacing * 0.2 * (0.8 + 0.45 * rand()),
        angle: flowAngle(noise, x, y, 1.6 / spacing, 1.2) + 0.5,
        curl: rand(),
        ink: Math.floor(rand() * inkCount),
      });
    }
    return out;
  }

  // ---------------------------------------------------------------- kani weave

  /** Thread colour index for a warp/weft thread: ground ink 0, accent inks drift by noise. */
  function threadInk(noise, index, axis, inkCount, accent) {
    var v = noise(index * 0.23 + axis * 37.7, axis * 11.3 + 0.5);
    if (inkCount < 2 || v < 1 - 2 * accent) return 0;
    var band = (v + 1) * 0.5;
    return 1 + (Math.floor(band * 97 + index * 0.05) % (inkCount - 1));
  }

  /**
   * 2/2 twill weave. Returns one combined SVG path per ink (index = ink), each made of the
   * thread "floats" that show on top. accent in [0, 1] = how many threads are coloured.
   */
  function weaveLayers(seed, width, height, cell, inkCount, accent) {
    var noise = createNoise2D(seed);
    var cols = Math.ceil(width / cell);
    var rows = Math.ceil(height / cell);
    var paths = [];
    var k;
    for (k = 0; k < inkCount; k++) paths.push('');
    var warpInk = [];
    var weftInk = [];
    for (k = 0; k < cols; k++) warpInk.push(threadInk(noise, k, 0, inkCount, accent));
    for (k = 0; k < rows; k++) weftInk.push(threadInk(noise, k, 1, inkCount, accent));
    var gap = Math.max(0.6, cell * 0.14);
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var warpOnTop = (i + j) % 4 < 2;
        var x = i * cell;
        var y = j * cell;
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
  function leafletPath(x, y, angle, len) {
    var c = Math.cos(angle);
    var s = Math.sin(angle);
    var tipX = x + c * len;
    var tipY = y + s * len;
    var w = len * 0.38;
    var mx = x + c * len * 0.5;
    var my = y + s * len * 0.5;
    return (
      'M' + fmt(x) + ' ' + fmt(y) +
      'Q' + fmt(mx - s * w) + ' ' + fmt(my + c * w) + ' ' + fmt(tipX) + ' ' + fmt(tipY) +
      'Q' + fmt(mx + s * w) + ' ' + fmt(my - c * w) + ' ' + fmt(x) + ' ' + fmt(y) + 'Z'
    );
  }

  /**
   * Self-drawing needle-stitch vines that travel left to right through a flow field.
   * Returns [{ stem, leaves, bud: { x, y, r }, ink }]. density in [0, 1].
   */
  function sozniVines(seed, width, height, count, density, inkCount) {
    var rand = mulberry32(seed + 101);
    var noise = createNoise2D(seed + 7);
    var step = Math.max(4, height * 0.045);
    var steps = Math.ceil((width * 1.15) / step);
    var leafEvery = Math.max(2, Math.round(lerp(6, 2, clamp01(density))));
    var vines = [];
    for (var v = 0; v < count; v++) {
      var x = -step;
      var y = height * lerp(0.15, 0.85, (v + 0.2 + rand() * 0.6) / count);
      var home = y;
      var pts = [[x, y]];
      var leaves = '';
      var side = rand() < 0.5 ? 1 : -1;
      for (var i = 0; i < steps; i++) {
        var a = flowAngle(noise, x, y, 2.2 / height, 0.45);
        // Keep vines heading right, pull gently back toward the vine's own lane.
        var pull = ((home - y) / height) * 1.4;
        a = a * 0.8 + pull;
        x += Math.cos(a) * step;
        y += Math.sin(a) * step;
        pts.push([x, y]);
        if (i > 0 && i % leafEvery === 0) {
          var la = a + side * (0.9 + rand() * 0.35);
          leaves += leafletPath(x, y, la, step * (1.0 + rand() * 0.5));
          side = -side;
        }
      }
      var last = pts[pts.length - 1];
      vines.push({
        stem: smoothPath(pts),
        leaves: leaves,
        bud: { x: last[0], y: last[1], r: step * 0.45 },
        ink: (v % Math.max(1, inkCount - 1)) + 1,
      });
    }
    return vines;
  }

  // ---------------------------------------------------------------- chinar leaf

  /** Radius of the five-lobed chinar outline at polar angle phi (0 = up). */
  function chinarRadius(phi) {
    // 1 - |sin|^0.8 gives broad lobes with pointed tips (a cusp at each peak).
    var lobes = 1 - Math.pow(Math.abs(Math.sin(phi * 2.5)), 0.8);
    var taper = 0.35 + 0.65 * Math.sqrt((1 + Math.cos(phi)) / 2);
    return (0.55 + 0.45 * lobes) * taper;
  }

  /** Chinar leaf outline centred near the origin, pointing up (stem at the bottom). */
  function chinarLeafPath(size) {
    var n = 90;
    var d = '';
    for (var i = 0; i < n; i++) {
      var phi = -Math.PI + (i / n) * TAU;
      var r = chinarRadius(phi) * size;
      var x = Math.sin(phi) * r;
      var y = -Math.cos(phi) * r + size * 0.15;
      d += (i === 0 ? 'M' : 'L') + fmt(x) + ' ' + fmt(y);
    }
    return d + 'Z';
  }

  /** Stem and the five main veins of a chinar leaf of the same size. */
  function chinarVeinPath(size) {
    var bx = 0;
    var by = size * 0.15;
    var d = 'M' + fmt(bx) + ' ' + fmt(by + size * 0.42) + 'L' + fmt(bx) + ' ' + fmt(by);
    var peaks = [0, 0.4, -0.4, 0.8, -0.8];
    for (var i = 0; i < peaks.length; i++) {
      var phi = peaks[i] * Math.PI;
      var r = chinarRadius(phi) * size * 0.82;
      d += 'M' + fmt(bx) + ' ' + fmt(by) + 'L' + fmt(Math.sin(phi) * r) + ' ' + fmt(-Math.cos(phi) * r + by);
    }
    return d;
  }

  /** Up to 3 drifting leaves for the sale celebration. */
  function leafDrift(seed, count, width, height) {
    var rand = mulberry32(seed + 31);
    var n = Math.min(3, Math.max(0, count));
    var out = [];
    for (var i = 0; i < n; i++) {
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

  /** Pose of a drifting leaf at normalised time t in [0, 1]. */
  function leafPose(p, t) {
    var tt = clamp01(t);
    var alpha = tt < 0.15 ? tt / 0.15 : tt > 0.72 ? 1 - (tt - 0.72) / 0.28 : 1;
    return {
      x: p.x0 + p.sway * Math.sin(p.phase + tt * TAU * 0.8),
      y: p.y0 + p.fall * (tt * (2 - tt) * 0.6 + tt * 0.4),
      rot: p.rot0 + p.spin * tt + 0.35 * Math.sin(p.phase + tt * TAU),
      alpha: clamp01(alpha),
    };
  }

  // ---------------------------------------------------------------- paisley confetti

  /** Burst particles (max 40). kind 0 = tiny boteh, 1 = round sequin. */
  function confettiParticles(seed, count) {
    var rand = mulberry32(seed + 53);
    var n = Math.min(40, Math.max(0, count));
    var out = [];
    for (var i = 0; i < n; i++) {
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

  /**
   * Particle pose at t in [0, 1] for a burst from (ox, oy); `reach` = burst radius in px.
   * Drag-damped launch plus gravity, fading out in the last 30%.
   */
  function confettiPose(p, t, ox, oy, reach) {
    var tt = clamp01(t);
    var secs = tt * 1.2;
    var d = (p.speed * reach * (1 - Math.exp(-3.2 * secs))) / (1 - Math.exp(-3.2 * 1.2));
    var gravity = reach * 0.9;
    return {
      x: ox + Math.cos(p.angle) * d,
      y: oy + Math.sin(p.angle) * d + 0.5 * gravity * secs * secs,
      rot: p.rot0 + p.spin * secs,
      alpha: tt < 0.7 ? 1 : 1 - (tt - 0.7) / 0.3,
    };
  }

  // ---------------------------------------------------------------- loom

  /**
   * Loom drawing for the empty-stock state: warp lines, a serpentine weft that goes over
   * and under each warp, and the two beams. All as SVG paths.
   */
  function loomGeometry(width, height, warpCount, rows) {
    var padX = width * 0.12;
    var top = height * 0.16;
    var bottom = height * 0.84;
    var span = width - padX * 2;
    var gapX = span / (warpCount - 1);
    var warp = '';
    var i;
    for (i = 0; i < warpCount; i++) {
      var x = padX + i * gapX;
      warp += 'M' + fmt(x) + ' ' + fmt(top) + 'L' + fmt(x) + ' ' + fmt(bottom);
    }
    var beams =
      'M' + fmt(padX - gapX * 0.6) + ' ' + fmt(top) + 'L' + fmt(width - padX + gapX * 0.6) + ' ' + fmt(top) +
      'M' + fmt(padX - gapX * 0.6) + ' ' + fmt(bottom) + 'L' + fmt(width - padX + gapX * 0.6) + ' ' + fmt(bottom);
    var rowH = (bottom - top) / (rows + 1);
    var amp = Math.min(rowH * 0.22, 2.5);
    var weft = '';
    for (var r = 0; r < rows; r++) {
      var y = bottom - (r + 1) * rowH;
      var ltr = r % 2 === 0;
      for (i = 0; i < warpCount; i++) {
        var idx = ltr ? i : warpCount - 1 - i;
        var wx = padX + idx * gapX;
        var wy = y + ((idx + r) % 2 === 0 ? -amp : amp);
        if (r === 0 && i === 0) weft += 'M' + fmt(wx) + ' ' + fmt(wy);
        else weft += 'L' + fmt(wx) + ' ' + fmt(wy);
      }
      if (r < rows - 1) {
        // Turn around the selvedge to the next row up.
        var edge = ltr ? width - padX + gapX * 0.35 : padX - gapX * 0.35;
        weft += 'Q' + fmt(edge) + ' ' + fmt(y - rowH * 0.5) + ' ' + fmt(ltr ? width - padX : padX) + ' ' + fmt(y - rowH);
      }
    }
    return { warp: warp, weft: weft, beams: beams };
  }

  // ---------------------------------------------------------------- Gathir mark

  /**
   * The Gathir paisley mark in a square of side `box`: three nested boteh "threads"
   * (ink 0, 1, 2) plus a seed dot (ink 3). Each thread also has a straight lead-in line
   * from outside the mark, used by the first-launch weave animation.
   * fill in (0, 1] = how much of the box the mark may occupy (icons need safe zones).
   */
  function gathirMark(box, fill) {
    var unit = (box * fill) / 3.2;
    var angle = -0.32;
    var cx = box * 0.5 - unit * 0.05;
    var cy = box * 0.5 + unit * 0.62;
    var scales = [1, 0.7, 0.42];
    var threads = [];
    for (var k = 0; k < scales.length; k++) {
      var s = unit * scales[k];
      var T = transformer(cx, cy + unit * (1 - scales[k]) * 0.55, s, angle);
      var start = T(0, 1);
      var fromLeft = k % 2 === 0;
      var leadY = start[1] + (k - 1) * unit * 0.12;
      threads.push({
        path: botehPath(cx, cy + unit * (1 - scales[k]) * 0.55, s, angle, 0.62),
        lead: 'M' + fmt(fromLeft ? -box * 0.1 : box * 1.1) + ' ' + fmt(leadY) + 'L' + fmt(start[0]) + ' ' + fmt(start[1]),
        ink: k,
        delay: k * 0.12,
      });
    }
    var dotCentre = transformer(cx, cy + unit * 0.32, unit, angle)(0, 0.12);
    return { threads: threads, dot: { x: dotCentre[0], y: dotCentre[1], r: unit * 0.13 }, strokeWidth: unit * 0.16 };
  }

  return {
    fmt: fmt,
    mulberry32: mulberry32,
    hashString: hashString,
    createNoise2D: createNoise2D,
    fbm2D: fbm2D,
    flowAngle: flowAngle,
    circlePath: circlePath,
    smoothPath: smoothPath,
    botehPath: botehPath,
    botehMotif: botehMotif,
    botehField: botehField,
    threadInk: threadInk,
    weaveLayers: weaveLayers,
    leafletPath: leafletPath,
    sozniVines: sozniVines,
    chinarLeafPath: chinarLeafPath,
    chinarVeinPath: chinarVeinPath,
    leafDrift: leafDrift,
    leafPose: leafPose,
    confettiParticles: confettiParticles,
    confettiPose: confettiPose,
    loomGeometry: loomGeometry,
    gathirMark: gathirMark,
  };
});
