/**
 * Shared print CSS: colour variables from the Vibrant Bazaar tokens (PLAN §9), font stacks,
 * and the reset every PDF template starts from. Templates add their own rules on top.
 */
import { PDF_DISPLAY_FAMILY, PDF_TEXT_FAMILY } from '../fontFamilies';
import { lightColors, palette } from '@/ui/tokens';

/** CSS font stacks: embedded brand faces first, then system fallbacks. */
export const DISPLAY_STACK = `"${PDF_DISPLAY_FAMILY}", "Noto Serif", Georgia, serif`;
export const TEXT_STACK = `"${PDF_TEXT_FAMILY}", Roboto, "Noto Sans", Arial, sans-serif`;

/** Brand colours as CSS custom properties, shared by every PDF. */
export const colourVariables = `
:root{
  --ivory:${palette.ivory};--white:${palette.white};--sand:${palette.sand};
  --walnut:${palette.walnut};--muted:${palette.walnutMuted};--rule:${lightColors.border};
  --chinar:${palette.chinar};--saffron:${palette.saffron};--teal:${palette.teal};
  --rose:${palette.rose};--meadow:${palette.meadow};--indigo:${palette.indigo};--low:${palette.lowText};
  --display:${DISPLAY_STACK};--text:${TEXT_STACK};
}`;

/** Reset + typographic defaults. Unitless line-heights; tabular figures wherever numbers align. */
export const baseCss = `
*,*::before,*::after{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{
  font-family:var(--text);font-size:9.5pt;line-height:1.45;color:var(--walnut);
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
  font-kerning:normal;text-rendering:optimizeLegibility;
}
h1,h2,h3,p{margin:0;}
h1,h2,h3{font-family:var(--display);font-weight:700;line-height:1.15;}
img{display:block;max-width:100%;}
svg{display:block;}
.num{font-variant-numeric:tabular-nums lining-nums;}
.muted{color:var(--muted);}
.nowrap{white-space:nowrap;}
`;

/** Full HTML document wrapper. `fontCss` is the embedded @font-face block (may be empty). */
export function htmlDocument(opts: { lang: string; dir: 'ltr' | 'rtl'; title: string; fontCss?: string; css: string; body: string }): string {
  return (
    `<!DOCTYPE html><html lang="${opts.lang}" dir="${opts.dir}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${opts.title}</title>` +
    `<style>${opts.fontCss ?? ''}\n${colourVariables}\n${baseCss}\n${opts.css}</style>` +
    `</head><body>${opts.body}</body></html>`
  );
}
