import '@/i18n';

import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { AppThemeProvider } from '@/ui/theme';

/** Renders a UI-kit element inside the app theme (and with English i18n loaded). */
export async function renderWithTheme(ui: ReactElement) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}
