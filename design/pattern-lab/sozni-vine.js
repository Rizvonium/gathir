/*
 * Sozni vines: needle-stitch stems travel left to right through a flow field, each pulled
 * back to its own lane, sprouting alternate leaflets and ending in a bud. The stems draw
 * themselves (path trim), leaflets bloom once the needle has passed.
 * App twin: the faint vines under PatternHeader (seed + 17, 2 vines, density 0.5).
 */
(function (root) {
  var G = root.GathirGeometry;
  var DRAW_S = 3.2;
  var HOLD_S = 1.6;

  root.GathirSketches.push({
    id: 'sozni-vine',
    title: 'Sozni vine',
    blurb: 'Self-drawing stitch vines. Density adds vines and leaflets; speed sets the needle.',
    app: 'PatternHeader (vine layer)',
    dp: { w: 360, h: 140 },
    defaults: { seed: 18, density: 0.5, palette: 0, speed: 1 },

    build: function (params, W, H, pal) {
      var count = 2 + Math.round(params.density * 3);
      return { vines: G.sozniVines(params.seed, W, H, count, params.density, pal.inks.length) };
    },

    frame: function (scene, t, params, pal) {
      var cycle = params.speed > 0 ? (t % (DRAW_S + HOLD_S)) / DRAW_S : 1;
      var f = Math.min(1, cycle);
      var layers = [];
      scene.vines.forEach(function (v, i) {
        var c = pal.inks[v.ink % pal.inks.length];
        var local = Math.max(0, Math.min(1, f * 1.25 - i * 0.08));
        layers.push({ d: v.stem, stroke: c, width: 1.4, trim: [0, local] });
        var bloom = Math.max(0, Math.min(1, (local - 0.55) / 0.45));
        layers.push({ d: v.leaves, fill: c, alpha: bloom });
        layers.push({ d: G.circlePath(v.bud.x, v.bud.y, v.bud.r), fill: pal.inks[1], alpha: local >= 1 ? 1 : 0 });
      });
      return { background: pal.bg, layers: layers, info: scene.vines.length + ' vines' };
    },
  });
})(typeof self !== 'undefined' ? self : this);
