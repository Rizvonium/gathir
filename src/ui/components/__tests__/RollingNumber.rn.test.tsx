import { AppThemeProvider } from '@/ui/theme';

import { RollingNumber } from '../RollingNumber';
import { renderWithTheme } from './renderWithTheme';

const mockTiming = jest.fn(<T,>(v: T) => v);
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('./reanimatedMock'),
  withTiming: (v: unknown) => mockTiming(v),
}));

describe('RollingNumber', () => {
  it('rolls when the value changes, and jumps when snapKey changes (a peer filter switch)', async () => {
    const ui = (value: number, snapKey: string) => (
      <AppThemeProvider>
        <RollingNumber value={value} snapKey={snapKey} testID="n" />
      </AppThemeProvider>
    );
    const view = await renderWithTheme(<RollingNumber value={12} snapKey="today" testID="n" />);
    mockTiming.mockClear();
    // A new sale under the same filter: the digits roll.
    await view.rerender(ui(34, 'today'));
    expect(mockTiming).toHaveBeenCalledTimes(2);
    mockTiming.mockClear();
    // Today → Week: the new totals appear at once.
    await view.rerender(ui(56, 'week'));
    expect(mockTiming).not.toHaveBeenCalled();
    expect(view.getByTestId('n').props.accessibilityLabel).toBe('56');
    // Then a sale in Week rolls again.
    await view.rerender(ui(78, 'week'));
    expect(mockTiming).toHaveBeenCalledTimes(2);
  });
});
