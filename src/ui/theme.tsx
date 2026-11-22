import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, fonts, lightColors, radius, space, type, type ColorTokens } from './tokens';

export type Theme = {
  scheme: 'light' | 'dark';
  colors: ColorTokens;
  fonts: typeof fonts;
  type: typeof type;
  space: typeof space;
  radius: typeof radius;
};

const ThemeContext = createContext<Theme | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const value = useMemo<Theme>(
    () => ({ scheme, colors: scheme === 'dark' ? darkColors : lightColors, fonts, type, space, radius }),
    [scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside AppThemeProvider');
  return t;
}
