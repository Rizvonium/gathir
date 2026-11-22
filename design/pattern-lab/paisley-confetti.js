/*
 * Paisley confetti: a drag-damped burst of tiny boteh and sequins with gravity, fading in
 * the last 30% (report-sent moment, 1.2 s). Density = particle count (8..40).
 * App twin: src/ui/patterns/PaisleyConfetti.tsx (seed 11, count 32, origin 0.5 / 0.6).
 */
(function (root) {
  var G = root.GathirGeometry;
  var CELL = 48;
  var PARTICLE_DP = 18;
  var DURATION_S = 1.2;
  var REST_S = 0.6;

  root.GathirSketches.push({
    id: 'paisley-confetti',
    title: 'Paisley confetti',
    blurb: 'Report-sent celebration. One sprite sheet (boteh | sequin) tinted per particle, like the Skia Atlas.',
    app: 'PaisleyConfetti',
    dp: { w: 360, h: 360 },
    defaults: { seed: 11, density: 0.75, palette: 0, speed: 1 },

    build: function (params, W, H) {
      var count = Math.round(8 + params.density * 32);
      return {
        W: W,
        H: H,
        particles: G.confettiParticles(params.seed, count),
        sprites: [G.botehPath(CELL / 2, CELL * 0.62, CELL * 0.27, 0, 0.5), G.circlePath(CELL * 1.5, CELL / 2, CELL * 0.3)],
      };
    },

    frame: function (scene, t, params, pal) {
      var p01 = params.speed > 0 ? Math.min(1, (t % (DURATION_S + REST_S)) / DURATION_S) : 0.3;
      var ox = scene.W * 0.5;
      var oy = scene.H * 0.6;
      var reach = Math.min(scene.W, scene.H) * 0.45;
      var layers = scene.particles.map(function (p) {
        var pose = G.confettiPose(p, p01, ox, oy, reach);
        var s = (PARTICLE_DP * p.scale) / CELL;
        // Sprites are authored around their cell centre, as in the Atlas RSXform.
        var cx = p.kind === 0 ? CELL / 2 : CELL * 1.5;
        var c = Math.cos(pose.rot) * s;
        var si = Math.sin(pose.rot) * s;
        return {
          d: scene.sprites[p.kind],
          fill: pal.inks[p.ink % pal.inks.length],
          alpha: pose.alpha,
          x: pose.x - (c * cx - si * (CELL / 2)),
          y: pose.y - (si * cx + c * (CELL / 2)),
          rot: pose.rot,
          scale: s,
        };
      });
      return { background: pal.bg, layers: layers, info: scene.particles.length + ' particles' };
    },
  });
})(typeof self !== 'undefined' ? self : this);
