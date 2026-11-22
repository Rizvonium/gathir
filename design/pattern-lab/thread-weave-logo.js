/*
 * Thread-weave logo: three threads run in from the edges and weave into the nested boteh
 * of the Gathir mark (1.2 s), then the seed dot settles. "Export SVG" at the end of the
 * cycle (or at speed 0) gives the finished mark used for icons and the splash.
 * App twin: src/ui/patterns/ThreadWeaveLogo.tsx (gathirMark(size, 0.86)).
 * The seed does not change the mark: a brand mark must be stable.
 */
(function (root) {
  var G = root.GathirGeometry;
  var WEAVE_S = 1.2;
  var HOLD_S = 1.4;
  var THREAD_SPAN = 0.76;

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  // Same curve as the app: Easing.bezier(0.33, 0, 0.2, 1), solved numerically.
  function ease(x) {
    var lo = 0;
    var hi = 1;
    for (var i = 0; i < 24; i++) {
      var m = (lo + hi) / 2;
      var bx = 3 * (1 - m) * (1 - m) * m * 0.33 + 3 * (1 - m) * m * m * 0.2 + m * m * m;
      if (bx < x) lo = m;
      else hi = m;
    }
    var u = (lo + hi) / 2;
    return 3 * (1 - u) * u * u + u * u * u;
  }

  root.GathirSketches.push({
    id: 'thread-weave-logo',
    title: 'Thread-weave logo',
    blurb: 'First launch. Each thread: lead line draws in, retracts, while its boteh outline draws on. Threads start 0.12 apart.',
    app: 'ThreadWeaveLogo',
    dp: { w: 240, h: 240 },
    defaults: { seed: 1, density: 0.86, palette: 0, speed: 1 },

    build: function (params, W) {
      return { mark: G.gathirMark(W, Math.max(0.5, Math.min(0.95, params.density))) };
    },

    frame: function (scene, t, params, pal) {
      var raw = params.speed > 0 ? clamp01((t % (WEAVE_S + HOLD_S)) / WEAVE_S) : 1;
      var p = ease(raw);
      var m = scene.mark;
      var layers = [];
      m.threads.forEach(function (th) {
        var local = clamp01((p - th.delay) / THREAD_SPAN);
        var c = pal.inks[th.ink];
        layers.push({ d: th.lead, stroke: c, width: m.strokeWidth * 0.55, trim: [clamp01((local - 0.4) / 0.5), clamp01(local / 0.4)] });
        layers.push({ d: th.path, stroke: c, width: m.strokeWidth, trim: [0, clamp01((local - 0.3) / 0.7)] });
      });
      layers.push({ d: G.circlePath(m.dot.x, m.dot.y, m.dot.r), fill: pal.inks[3], alpha: clamp01((p - 0.8) / 0.2) });
      return { background: pal.bg, layers: layers, info: 'progress ' + p.toFixed(2) + ' · density = mark fill' };
    },
  });
})(typeof self !== 'undefined' ? self : this);
