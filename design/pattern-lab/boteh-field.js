/*
 * Boteh field: paisley forms seeded along a domain-warped flow field, over faint sozni
 * vines. The band drifts sideways at speed × 0.02 cycles/s, exactly like the app.
 * App twin: src/ui/patterns/PatternHeader.tsx (seed 1, density 0.45, 360×140 dp).
 */
(function (root) {
  var G = root.GathirGeometry;

  root.GathirSketches.push({
    id: 'boteh-field',
    title: 'Boteh field',
    blurb: 'Header band for Home and Showroom. Each boteh leans into the flow field; colours rotate outline → inner → seed dots.',
    app: 'PatternHeader',
    dp: { w: 360, h: 140 },
    defaults: { seed: 1, density: 0.45, palette: 0, speed: 1 },

    build: function (params, W, H, pal) {
      var inks = pal.inks;
      var field = G.botehField(params.seed, W, H, params.density, inks.length);
      var outline = inks.map(function () { return ''; });
      var inner = inks.map(function () { return ''; });
      var dots = inks.map(function () { return ''; });
      var stroke = 1.5;
      field.forEach(function (b) {
        var m = G.botehMotif(b.x, b.y, b.size, b.angle, b.curl);
        outline[b.ink] += m.outline;
        inner[(b.ink + 1) % inks.length] += m.inner;
        m.dots.forEach(function (d) { dots[(b.ink + 2) % inks.length] += G.circlePath(d.x, d.y, d.r); });
        stroke = Math.max(1.25, b.size * 0.12);
      });
      var vines = G.sozniVines(params.seed + 17, W, H, 2, 0.5, inks.length);
      return { W: W, outline: outline, inner: inner, dots: dots, stroke: stroke, vines: vines, count: field.length };
    },

    frame: function (scene, t, params, pal) {
      var layers = [];
      scene.vines.forEach(function (v) {
        var c = pal.inks[v.ink % pal.inks.length];
        layers.push({ d: v.stem, stroke: c, width: 1, alpha: 0.3 });
        layers.push({ d: v.leaves, fill: c, alpha: 0.3 });
      });
      var phase = (t * 0.02) % 1;
      // Tiles at -1..2 widths: every boteh exists once per tile, so the wrap is seamless.
      for (var k = -1; k <= 2; k++) {
        var x = (k - phase) * scene.W;
        pal.inks.forEach(function (c, i) {
          layers.push({ d: scene.outline[i], stroke: c, width: scene.stroke, x: x });
          layers.push({ d: scene.inner[i], fill: c, x: x });
          layers.push({ d: scene.dots[i], fill: c, x: x });
        });
      }
      return { background: pal.sunken, layers: layers, info: scene.count + ' boteh' };
    },
  });
})(typeof self !== 'undefined' ? self : this);
