# Gathir Pattern Lab

Design-time playground for the app's generative art (docs/PLAN.md §9–§11). Every pattern
here is drawn from `geometry.js`, the same seeded maths the phone runs in
`src/ui/patterns/geometry.ts`. **Same seed, same size → the same art on both.**

## Counted Thread: the idea behind the patterns

Kashmiri shawls are counted work: a kani weaver reads a coded talim and moves bobbins
thread by thread, and a sozni embroiderer lays one tiny stitch after another until a vine
appears. Counted Thread treats every pattern the same way. Nothing is placed by hand.
A 32-bit seed starts a small PRNG (mulberry32) and a gradient-noise field, and every form
grows from those two sources by rule. Swap the seed and you get a new shawl from the same
loom.

The forms are organic but their placement is counted. Boteh are scattered by dart
throwing, so no two are closer than a fixed spacing, and each one turns to face a
domain-warped flow field. That is why the field looks like it was laid out by eye. Sozni
vines go stitch by stitch: each step reads the field and is pulled back toward the vine's
own lane, and a leaflet grows on alternating sides every few steps. The kani twill is a
strict 2/2 over-under grid. Colour enters only where noise along a thread rises above an
accent line, the way a weaver brings in a new bobbin.

Motion follows the same thrift. The header band drifts one tile every 50 seconds. The
chinar leaves are three particles with a closed-form pose `leafPose(t)`. The confetti is
40 precomputed particles with drag-damped launch and gravity. The logo is three threads
drawn with path trim. No simulation state is kept between frames, so any frame can be
computed from `t` alone, and the phone runs each one on the UI thread with no allocation.

Every shape is original. The boteh is six cubic segments: a bulb, a rising tip and an
inward hook. The chinar leaf is a five-lobed polar curve with cusp-tipped lobes. The weave
is plain arithmetic. None of it is traced from a real shawl or from another artist's work.

## How to use

1. Open `index.html` in a desktop browser (double-click it; no server needed). p5.js 1.11.3
   loads from cdnjs, so you need to be online the first time.
2. Pick a sketch on the left. Move **Seed**, **Density**, **Palette** and **Speed**; the
   geometry rebuilds as you change them.
3. **Export SVG** saves the current frame as vectors (for PDFs, icons, print).
   **Save PNG** saves the canvas at 2× zoom × device pixel ratio. Keep picks in `exports/`.
4. When a seed looks right, put it in the app component's `seed` prop (table below).

Keys: `S` save PNG · `V` export SVG · space pause · ← / → previous / next seed.

Palettes mirror `src/ui/tokens.ts` (`palettes.js`): 0 Pashmina day (light), 1 Dal at night
(dark), 2 Chinar ground (icon). Ink order matches `patternInks()` in `src/ui/patterns/inks.ts`.

## Sketch → app component

Sizes are in dp; the lab builds geometry at the phone size and only zooms the canvas.

| Sketch | App component | Geometry | App defaults | Lab sliders mean |
|---|---|---|---|---|
| `boteh-field.js` | `PatternHeader` | `botehField`, `botehMotif`, `sozniVines(seed + 17, …)` | seed 1, density 0.45, 360×140 | density = boteh count, speed = drift (1 = app's 0.02 cycles/s) |
| `kani-weave.js` | `KaniWeaveBackground`, placeholder ground | `weaveLayers` | seed 3, cell 8, accent 0.22, intensity 0.12 | density = `accent`, speed = weave-in replay (lab only) |
| `sozni-vine.js` | vine layer of `PatternHeader` | `sozniVines` | header uses seed + 17, 2 vines, density 0.5 | density = vine count and leaflet spacing, speed = needle |
| `chinar-fall.js` | `ChinarLeaves` | `leafDrift`, `leafPose`, `chinarLeafPath` | seed 7, count 2, 900 ms | density = 1..3 leaves |
| `paisley-confetti.js` | `PaisleyConfetti` | `confettiParticles`, `confettiPose` | seed 11, count 32, 1.2 s | density = 8..40 particles |
| `thread-weave-logo.js` | `ThreadWeaveLogo` | `gathirMark` | fill 0.86, 1.2 s | density = mark fill; seed is ignored on purpose |
| (no sketch) | `PatternPlaceholder` | `hashString(productId)` → seed, `botehMotif`, `weaveLayers` | per product | — |
| (no sketch) | `LoomEmptyState` | `loomGeometry` | 13 warps, 9 rows, 7 s loop | — |

## The 1:1 mapping (geometry.js ⇔ geometry.ts)

- Every function in `geometry.js` has an export with the **same name, arguments and
  output** in `src/ui/patterns/geometry.ts`. The TS file adds types and marks the
  per-frame functions (`leafPose`, `confettiPose`) as `'worklet'` for the UI thread.
- Shapes are **SVG path strings** with coordinates rounded to 2 decimals (`fmt`). The lab
  draws them with `Path2D`; Skia reads them with `Skia.Path.MakeFromSVGString`. Neither
  side converts or re-samples the shapes.
- Neither side uses `Math.random` or p5's `random()`/`noise()` for geometry. The sketches
  still call `randomSeed`/`noiseSeed`, but only out of habit.
- `src/ui/patterns/__tests__/geometry.node.test.ts` loads **both** files and checks that
  they give identical output for several seeds. If you change the maths here, port it to
  the TS file in the same change, or the test fails.
- `geometry.js` is UMD rather than an ES module so it works from `file://` (browsers block
  module scripts there), from Jest, and from Node scripts.

## Frames as layers (`render.js`)

Each sketch's `frame(scene, t)` returns a list of layers:
`{ d, fill?, stroke?, width?, alpha?, x?, y?, rot?, scale?, trim?: [start, end], clip? }`.
`drawLayers` paints them on the canvas. `layersToSVG` writes the same list as SVG, using
`pathLength="1"` plus a dash array for trims, so the exported SVG matches what you see.
That is how "Export SVG" works without p5.svg.

## Brand mark and app icons (`design/brand/`)

`node design/brand/render-brand.cjs` writes the mark as SVG to `design/brand/*.svg` and as
PNG to `assets/images/` (icon, adaptive foreground and monochrome, splash). It draws with
CanvasKit, which ships with `@shopify/react-native-skia`. The output is the same every run.
