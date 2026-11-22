/*
 * Renders the Gathir paisley mark to SVG (design/brand/*.svg) and PNG (assets/images/*).
 * Same geometry as the app and the Pattern Lab (design/pattern-lab/geometry.js →
 * gathirMark), rasterised with CanvasKit (Skia for WebAssembly, already a dependency of
 * @shopify/react-native-skia). Deterministic: run it again, get the same bytes.
 *
 *   node design/brand/render-brand.cjs            # writes SVGs + PNGs
 *   node design/brand/render-brand.cjs --svg-only # SVGs only
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const G = require(path.join(ROOT, 'design/pattern-lab/geometry.js'));
const CanvasKitInit = require(path.join(ROOT, 'node_modules/canvaskit-wasm/bin/canvaskit.js'));

// Vibrant Bazaar tokens (src/ui/tokens.ts).
const C = { ivory: '#FFF8EE', sand: '#F6ECDD', chinar: '#C62F17', saffron: '#F4A300', teal: '#0B6E77', rose: '#B0124F', white: '#FFFFFF' };

/** Each target: square size, mark fill, optional background, ink per thread and dot. */
const TARGETS = [
  // Legacy/launcher icon: full-bleed chinar square.
  { name: 'icon', size: 1024, fill: 0.62, bg: C.chinar, inks: [C.ivory, C.saffron, C.ivory], dot: C.saffron },
  // Adaptive foreground: the mark must sit inside the 66/108 safe circle (fill 0.5).
  { name: 'android-icon-foreground', size: 1024, fill: 0.5, bg: null, inks: [C.ivory, C.saffron, C.ivory], dot: C.saffron },
  // Adaptive background (plain chinar): replaces the Expo template grid if app.json points at it.
  { name: 'android-icon-background', size: 1024, fill: 0, bg: C.chinar, inks: [], dot: null, brandOnly: true },
  // Themed (monochrome) icon: Android tints the alpha channel.
  { name: 'android-icon-monochrome', size: 1024, fill: 0.5, bg: null, inks: [C.white, C.white, C.white], dot: C.white },
  // Splash: transparent, full colour; reads on ivory (light) and night (dark) splash grounds.
  { name: 'splash-icon', size: 1024, fill: 0.72, bg: null, inks: [C.chinar, C.saffron, C.teal], dot: C.rose },
];

function markLayers(t) {
  if (t.fill <= 0) return [];
  const m = G.gathirMark(t.size, t.fill);
  const layers = m.threads.map((th) => ({ d: th.path, stroke: t.inks[th.ink], width: m.strokeWidth }));
  layers.push({ d: G.circlePath(m.dot.x, m.dot.y, m.dot.r), fill: t.dot });
  return layers;
}

function toSVG(t) {
  const s = t.size;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">\n`;
  if (t.bg) out += `<rect width="${s}" height="${s}" fill="${t.bg}"/>\n`;
  for (const l of markLayers(t)) {
    out += l.stroke
      ? `<path d="${l.d}" fill="none" stroke="${l.stroke}" stroke-width="${G.fmt(l.width)}" stroke-linecap="round" stroke-linejoin="round"/>\n`
      : `<path d="${l.d}" fill="${l.fill}"/>\n`;
  }
  return out + '</svg>\n';
}

async function main() {
  const svgOnly = process.argv.includes('--svg-only');
  for (const t of TARGETS) fs.writeFileSync(path.join(__dirname, `${t.name}.svg`), toSVG(t));
  if (svgOnly) return;

  const CK = await CanvasKitInit({ locateFile: (f) => path.join(ROOT, 'node_modules/canvaskit-wasm/bin', f) });
  for (const t of TARGETS) {
    const surface = CK.MakeSurface(t.size, t.size);
    const canvas = surface.getCanvas();
    canvas.clear(t.bg ? CK.parseColorString(t.bg) : CK.TRANSPARENT);
    for (const l of markLayers(t)) {
      const paint = new CK.Paint();
      paint.setAntiAlias(true);
      const p = CK.Path.MakeFromSVGString(l.d);
      if (l.stroke) {
        paint.setStyle(CK.PaintStyle.Stroke);
        paint.setStrokeWidth(l.width);
        paint.setStrokeCap(CK.StrokeCap.Round);
        paint.setStrokeJoin(CK.StrokeJoin.Round);
        paint.setColor(CK.parseColorString(l.stroke));
      } else {
        paint.setColor(CK.parseColorString(l.fill));
      }
      canvas.drawPath(p, paint);
      p.delete();
      paint.delete();
    }
    surface.flush();
    const bytes = surface.makeImageSnapshot().encodeToBytes();
    // The adaptive background is a suggestion (app.json is not owned by the pattern work).
    const dir = t.brandOnly ? __dirname : path.join(ROOT, 'assets/images');
    fs.writeFileSync(path.join(dir, `${t.name}.png`), Buffer.from(bytes));
    surface.delete();
    console.log(`wrote ${path.relative(ROOT, path.join(dir, t.name + '.png'))}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
