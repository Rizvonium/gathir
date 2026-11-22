/*
 * Chinar fall: at most three five-lobed chinar leaves drift, sway and fade in 900 ms
 * (the sale-completed moment). Density = leaf count (1..3). Speed = playback rate.
 * App twin: src/ui/patterns/ChinarLeaves.tsx (seed 7, count 2, 900 ms).
 */
(function (root) {
  var G = root.GathirGeometry;
  var BASE = 100;
  var DURATION_S = 0.9;
  var REST_S = 0.7;

  root.GathirSketches.push({
    id: 'chinar-fall',
    title: 'Chinar fall',
    blurb: 'Sale celebration. Particles are precomputed; leafPose(t) is the only per-frame maths.',
    app: 'ChinarLeaves',
    dp: { w: 360, h: 360 },
    defaults: { seed: 7, density: 0.5, palette: 0, speed: 1 },

    build: function (params, W, H) {
      var count = 1 + Math.round(params.density * 2);
      return { leaf: G.chinarLeafPath(BASE), veins: G.chinarVeinPath(BASE), particles: G.leafDrift(params.seed, count, W, H) };
    },

    frame: function (scene, t, params, pal) {
      var p01 = params.speed > 0 ? Math.min(1, (t % (DURATION_S + REST_S)) / DURATION_S) : 0.45;
      var leafInks = [pal.inks[0], pal.inks[1]];
      var layers = [];
      scene.particles.forEach(function (p) {
        var pose = G.leafPose(p, p01);
        var common = { x: pose.x, y: pose.y, rot: pose.rot, scale: p.size / BASE };
        layers.push(Object.assign({ d: scene.leaf, fill: leafInks[p.ink % 2], alpha: pose.alpha }, common));
        layers.push(Object.assign({ d: scene.veins, stroke: pal.bg, width: 4, alpha: pose.alpha * 0.7 }, common));
      });
      return { background: pal.bg, layers: layers, info: 't = ' + p01.toFixed(2) };
    },
  });
})(typeof self !== 'undefined' ? self : this);
