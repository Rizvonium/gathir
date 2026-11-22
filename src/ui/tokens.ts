/**
 * Vibrant Bazaar design tokens (docs/PLAN.md §9).
 * Every colour pair used for text has been checked against WCAG AA.
 * Screens must use these tokens via useTheme(), never hard-coded hex values.
 */

export const palette = {
  ivory: '#FFF8EE',
  white: '#FFFFFF',
  sand: '#F6ECDD',
  walnut: '#2B1A12',
  walnutMuted: '#6B5446',
  chinar: '#C62F17',
  chinarDark: '#FF7452',
  saffron: '#F4A300',
  saffronDark: '#FFC24B',
  teal: '#0B6E77',
  tealDark: '#4CC9D1',
  rose: '#B0124F',
  meadow: '#23794A',
  indigo: '#3B3A98',
  lowText: '#8A4F00',
  night: '#15101F',
  nightSurface: '#1F1830',
  nightSunken: '#100C18',
  nightText: '#F8EEDF',
  nightMuted: '#BFAE9C',
} as const;

export type ColorTokens = {
  bg: string;
  surface: string;
  surfaceSunken: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  saffron: string;
  onSaffron: string;
  teal: string;
  onTeal: string;
  rose: string;
  meadow: string;
  indigo: string;
  onAccent: string;
  lowText: string;
  danger: string;
  scrim: string;
  stockOk: string;
  stockLow: string;
  stockOut: string;
};

export const lightColors: ColorTokens = {
  bg: palette.ivory,
  surface: palette.white,
  surfaceSunken: palette.sand,
  border: '#E8D9C4',
  text: palette.walnut,
  textMuted: palette.walnutMuted,
  primary: palette.chinar,
  onPrimary: palette.white,
  saffron: palette.saffron,
  onSaffron: palette.walnut,
  teal: palette.teal,
  onTeal: palette.white,
  rose: palette.rose,
  meadow: palette.meadow,
  indigo: palette.indigo,
  onAccent: palette.white,
  lowText: palette.lowText,
  danger: '#B3261E',
  scrim: 'rgba(43,26,18,0.45)',
  stockOk: palette.meadow,
  stockLow: palette.saffron,
  stockOut: palette.chinar,
};

export const darkColors: ColorTokens = {
  bg: palette.night,
  surface: palette.nightSurface,
  surfaceSunken: palette.nightSunken,
  border: '#2E2645',
  text: palette.nightText,
  textMuted: palette.nightMuted,
  primary: palette.chinarDark,
  onPrimary: palette.night,
  saffron: palette.saffronDark,
  onSaffron: palette.night,
  teal: palette.tealDark,
  onTeal: palette.night,
  rose: '#FF6FA3',
  meadow: '#5FD08F',
  indigo: '#9C9BFF',
  onAccent: palette.night,
  lowText: palette.saffronDark,
  danger: '#FF8A80',
  scrim: 'rgba(0,0,0,0.6)',
  stockOk: '#5FD08F',
  stockLow: palette.saffronDark,
  stockOut: palette.chinarDark,
};

/** Font family names registered in the root layout via expo-font. */
export const fonts = {
  display: 'Fraunces_700Bold',
  displaySemi: 'Fraunces_600SemiBold',
  body: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  bodySemi: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
} as const;

/** Type scale in sp. `count` is for big piece counts. */
export const type = {
  caption: { fontSize: 12, lineHeight: 16 },
  small: { fontSize: 14, lineHeight: 20 },
  body: { fontSize: 16, lineHeight: 24 },
  title: { fontSize: 20, lineHeight: 28 },
  heading: { fontSize: 24, lineHeight: 32 },
  display: { fontSize: 32, lineHeight: 40 },
  count: { fontSize: 44, lineHeight: 52 },
} as const;

/** 4-pt spacing grid. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  card: 20,
  sheet: 28,
  pill: 999,
} as const;

/** Minimum touch target on Android (dp). */
export const touchTarget = 48;

/** Named swatches sellers pick colours from. */
export const shawlSwatches: { key: string; name: string; hex: string }[] = [
  { key: 'red', name: 'Red', hex: '#C0262D' },
  { key: 'maroon', name: 'Maroon', hex: '#6D1A24' },
  { key: 'pink', name: 'Pink', hex: '#E38AAE' },
  { key: 'rani', name: 'Rani pink', hex: '#C2185B' },
  { key: 'orange', name: 'Orange', hex: '#E4572E' },
  { key: 'mustard', name: 'Mustard', hex: '#D4A017' },
  { key: 'beige', name: 'Beige', hex: '#D8C3A5' },
  { key: 'cream', name: 'Cream', hex: '#F3E9D2' },
  { key: 'white', name: 'White', hex: '#FAFAF7' },
  { key: 'grey', name: 'Grey', hex: '#8E8E93' },
  { key: 'black', name: 'Black', hex: '#1B1B1B' },
  { key: 'brown', name: 'Brown', hex: '#6F4E37' },
  { key: 'green', name: 'Green', hex: '#2E7D4F' },
  { key: 'teal', name: 'Teal', hex: '#0B6E77' },
  { key: 'blue', name: 'Blue', hex: '#2F5DA8' },
  { key: 'navy', name: 'Navy', hex: '#1F2A56' },
  { key: 'purple', name: 'Purple', hex: '#5E3A8C' },
  { key: 'multi', name: 'Multicolour', hex: 'multi' },
];
