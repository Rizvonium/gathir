import type { ColorTokens } from '../tokens';

/**
 * Pattern inks, in a fixed order shared with the Pattern Lab palettes
 * (design/pattern-lab/palettes.js): ink 0 is the lead thread colour.
 * Index meaning: 0 primary (chinar) · 1 saffron · 2 teal · 3 rose · 4 indigo · 5 meadow.
 */
export function patternInks(colors: ColorTokens): string[] {
  return [colors.primary, colors.saffron, colors.teal, colors.rose, colors.indigo, colors.meadow];
}

/** Pick an ink by index, wrapping around. */
export function inkAt(inks: readonly string[], index: number): string {
  return inks[((index % inks.length) + inks.length) % inks.length];
}
