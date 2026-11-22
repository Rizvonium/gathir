/*
 * One renderer, two outputs. A sketch describes a frame as a list of LAYERS:
 *   { d, fill?, stroke?, width?, alpha?, x?, y?, rot?, scale?, trim?: [start, end] }
 * where `d` is an SVG path string from geometry.js. drawLayers() paints them on the p5
 * canvas via Path2D (the very strings Skia parses in the app); layersToSVG() writes the
 * same layers as an SVG document. This is how "Export SVG" works without p5.svg.
 */
(function (root) {
  var pathCache = new Map();
  var lengthCache = new Map();
  var measurer = null;

  function path2d(d) {
    var p = pathCache.get(d);
    if (!p) {
      if (pathCache.size > 400) pathCache.clear();
      p = new Path2D(d);
      pathCache.set(d, p);
    }
    return p;
  }

  /** Path length via an off-screen SVG element (cached); needed to trim strokes on canvas. */
  function pathLength(d) {
    var len = lengthCache.get(d);
    if (len === undefined) {
      if (!measurer) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.position = 'absolute';
        measurer = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        svg.appendChild(measurer);
        document.body.appendChild(svg);
      }
      measurer.setAttribute('d', d);
      len = measurer.getTotalLength();
      lengthCache.set(d, len);
    }
    return len;
  }

  function hasTransform(l) {
    return l.x !== undefined || l.y !== undefined || l.rot !== undefined || l.scale !== undefined;
  }

  /** Paint layers on a CanvasRenderingContext2D (p5: p.drawingContext). */
  function drawLayers(ctx, layers) {
    for (var i = 0; i < layers.length; i++) {
      var l = layers[i];
      if (!l.d) continue;
      ctx.save();
      if (l.clip) {
        ctx.beginPath();
        ctx.rect(l.clip[0], l.clip[1], l.clip[2], l.clip[3]);
        ctx.clip();
      }
      if (hasTransform(l)) {
        ctx.translate(l.x || 0, l.y || 0);
        ctx.rotate(l.rot || 0);
        var s = l.scale === undefined ? 1 : l.scale;
        ctx.scale(s, s);
      }
      ctx.globalAlpha = l.alpha === undefined ? 1 : l.alpha;
      var p = path2d(l.d);
      if (l.fill) {
        ctx.fillStyle = l.fill;
        ctx.fill(p);
      }
      if (l.stroke) {
        ctx.strokeStyle = l.stroke;
        ctx.lineWidth = l.width || 1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (l.trim) {
          var len = pathLength(l.d);
          var a = Math.max(0, Math.min(1, l.trim[0]));
          var b = Math.max(a, Math.min(1, l.trim[1]));
          if (b - a <= 0) {
            ctx.restore();
            continue;
          }
          ctx.setLineDash([(b - a) * len, len * 2]);
          ctx.lineDashOffset = -a * len;
        }
        ctx.stroke(p);
      }
      ctx.restore();
    }
  }

  function attr(name, value) {
    return ' ' + name + '="' + value + '"';
  }

  /** Serialise layers as a standalone SVG document (same coordinates as the canvas). */
  function layersToSVG(width, height, background, layers) {
    var out = '<svg xmlns="http://www.w3.org/2000/svg"' + attr('width', width) + attr('height', height) +
      attr('viewBox', '0 0 ' + width + ' ' + height) + '>\n';
    if (background) out += '<rect' + attr('width', width) + attr('height', height) + attr('fill', background) + '/>\n';
    var clips = 0;
    for (var i = 0; i < layers.length; i++) {
      var l = layers[i];
      if (!l.d) continue;
      if (l.trim && Math.min(1, l.trim[1]) - Math.max(0, l.trim[0]) <= 0) continue;
      var a = '';
      if (l.clip) {
        clips++;
        out += '<clipPath id="c' + clips + '"><rect' + attr('x', l.clip[0]) + attr('y', l.clip[1]) + attr('width', l.clip[2]) +
          attr('height', l.clip[3]) + '/></clipPath>\n';
        out += '<g' + attr('clip-path', 'url(#c' + clips + ')') + '>';
      }
      if (hasTransform(l)) {
        a += attr('transform', 'translate(' + (l.x || 0) + ' ' + (l.y || 0) + ') rotate(' + ((l.rot || 0) * 180) / Math.PI +
          ') scale(' + (l.scale === undefined ? 1 : l.scale) + ')');
      }
      if (l.alpha !== undefined && l.alpha < 1) a += attr('opacity', l.alpha.toFixed(3));
      a += attr('fill', l.fill || 'none');
      if (l.stroke) {
        a += attr('stroke', l.stroke) + attr('stroke-width', l.width || 1) + attr('stroke-linecap', 'round') + attr('stroke-linejoin', 'round');
        if (l.trim) {
          var s0 = Math.max(0, Math.min(1, l.trim[0]));
          var s1 = Math.max(s0, Math.min(1, l.trim[1]));
          a += attr('pathLength', '1') + attr('stroke-dasharray', (s1 - s0).toFixed(4) + ' 2') + attr('stroke-dashoffset', (-s0).toFixed(4));
        }
      }
      out += '<path' + attr('d', l.d) + a + '/>' + (l.clip ? '</g>' : '') + '\n';
    }
    return out + '</svg>\n';
  }

  root.GathirRender = { drawLayers: drawLayers, layersToSVG: layersToSVG, pathLength: pathLength };
  root.GathirSketches = root.GathirSketches || [];
})(typeof self !== 'undefined' ? self : this);
