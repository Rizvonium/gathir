/**
 * Turns the real catalogue HTML into an on-screen preview (PLAN §10 "PDF preview": pages fan in,
 * 60 ms apart, 5 pages max; reduced motion = no motion). The PDF itself is never changed.
 */

/** CSS pixel width of an A4 page (210 mm at 96 dpi) plus a margin each side. */
export const PREVIEW_VIEWPORT_WIDTH = 860;
export const FAN_STAGGER_MS = 60;
export const FAN_MAX_PAGES = 5;
export const FAN_DURATION_MS = 420;

export type PreviewStyle = {
  /** Page-well colour behind the paper (theme surfaceSunken). */
  background: string;
  /** Page shadow colour (theme scrim). */
  shadow: string;
  reducedMotion: boolean;
};

function fanCss(): string {
  const rules: string[] = [
    `@keyframes gathir-fan{from{opacity:0;transform:translateY(28px) rotate(var(--tilt)) scale(.96);}to{opacity:1;transform:none;}}`,
    `main>.page{animation:gathir-fan ${FAN_DURATION_MS}ms cubic-bezier(.23,1,.32,1) both;}`,
    `main>.page:nth-child(n+${FAN_MAX_PAGES + 1}){animation:none;}`,
  ];
  for (let i = 1; i <= FAN_MAX_PAGES; i++) {
    const tilt = i % 2 === 0 ? 1.2 : -1.2;
    rules.push(`main>.page:nth-child(${i}){animation-delay:${(i - 1) * FAN_STAGGER_MS}ms;--tilt:${tilt}deg;}`);
  }
  return rules.join('');
}

/** Injects the preview viewport and page-well styles. Pure. */
export function previewHtml(html: string, style: PreviewStyle): string {
  const viewport = `<meta name="viewport" content="width=${PREVIEW_VIEWPORT_WIDTH}, user-scalable=yes">`;
  const css =
    `<style id="gathir-preview">` +
    `html,body{background:${style.background}!important;margin:0;}` +
    `main{display:flex;flex-direction:column;align-items:center;gap:28px;padding:28px 0 48px;}` +
    `main>.page{box-shadow:0 6px 24px ${style.shadow};border-radius:2px;}` +
    (style.reducedMotion ? '' : fanCss()) +
    `</style>`;
  const withViewport = /<meta[^>]*name=["']viewport["'][^>]*>/i.test(html)
    ? html.replace(/<meta[^>]*name=["']viewport["'][^>]*>/i, viewport)
    : html.replace(/<head>/i, `<head>${viewport}`);
  return /<\/head>/i.test(withViewport) ? withViewport.replace(/<\/head>/i, `${css}</head>`) : `${css}${withViewport}`;
}
