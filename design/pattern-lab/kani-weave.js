/*
 * Kani weave: a 2/2 twill where a few warp and weft threads drift into colour, the way
 * kani tapestry threads change bobbins. Density = share of coloured threads.
 * Speed (lab only) replays the cloth being woven row by row; at speed 0 it is the static
 * texture the app draws. App twin: src/ui/patterns/KaniWeaveBackground.tsx
 * (seed 3, cell 8, accent 0.22, intensity 0.12) and placeholder grounds.
 */
(function (root) {
  var G = root.GathirGeometry;
  var CELL = 8;

  root.GathirSketches.push({
    id: 'kani-weave',
    title: 'Kani weave',
    blurb: 'Quiet twill for cards and empty states. Coloured threads appear where seeded noise crosses the accent line.',
    app: 'KaniWeaveBackground',
    dp: { w: 360, h: 220 },
    defaults: { seed: 3, density: 0.22, palette: 0, speed: 0 },
    // The app draws this at intensity 0.12; the lab shows it at full strength to judge it.
    build: function (params, W, H, pal) {
      var inks = [pal.muted].concat(pal.inks.slice(0, 5));
      return { W: W, H: H, inks: inks, layers: G.weaveLayers(params.seed, W, H, CELL, inks.length, params.density) };
    },

    frame: function (scene, t, params) {
      var rows = Math.ceil(scene.H / CELL);
      var woven = params.speed > 0 ? Math.min(rows, Math.floor(((t * 3) % (rows + 12)))) * CELL : scene.H;
      var clip = [0, 0, scene.W, woven];
      var layers = scene.layers.map(function (d, i) {
        return { d: d, fill: scene.inks[i], alpha: i === 0 ? 0.35 : 0.9, clip: clip };
      });
      return { background: null, layers: layers, info: rows + ' rows' };
    },
  });
})(typeof self !== 'undefined' ? self : this);
