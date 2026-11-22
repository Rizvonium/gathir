/**
 * Fits the real A4 report HTML into the phone preview: a viewport the width of one page and a
 * page-well background. The PDF itself is printed from the untouched HTML. Pure.
 */
export const PREVIEW_VIEWPORT_WIDTH = 860;

export function previewHtml(html: string, style: { background: string; shadow: string }): string {
  const viewport = `<meta name="viewport" content="width=${PREVIEW_VIEWPORT_WIDTH}, user-scalable=yes">`;
  const css =
    `<style id="gathir-preview">html,body{background:${style.background}!important;margin:0;}` +
    `main{display:flex;flex-direction:column;align-items:center;gap:28px;padding:28px 0 48px;}` +
    `main>.page{box-shadow:0 6px 24px ${style.shadow};}</style>`;
  const metaRe = /<meta[^>]*name=["']viewport["'][^>]*>/i;
  const withViewport = metaRe.test(html) ? html.replace(metaRe, viewport) : html.replace(/<head>/i, `<head>${viewport}`);
  return /<\/head>/i.test(withViewport) ? withViewport.replace(/<\/head>/i, `${css}</head>`) : `${css}${withViewport}`;
}
