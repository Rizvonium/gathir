import { screen } from '@testing-library/react-native';

import { AppThemeProvider } from '@/ui/theme';

import { PieceBadge } from '../PieceBadge';
import { thumbnailTransition } from '../Thumbnail';
import { stockStatusOf } from '../stockStatus';
import { renderWithTheme } from './renderWithTheme';

jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...a: unknown[]) => void, ...a: unknown[]) => fn(...a) }));
jest.mock('react-native-reanimated', () => require('./reanimatedMock'));

describe('PieceBadge', () => {
  it('shows piece count when in stock', async () => {
    await renderWithTheme(<PieceBadge count={12} />);
    expect(screen.getByText('12 pieces')).toBeTruthy();
    expect(screen.getByLabelText('In stock, 12 pieces')).toBeTruthy();
  });

  it('shows "Only N left" at or below the low threshold', async () => {
    await renderWithTheme(<PieceBadge count={3} lowThreshold={3} />);
    expect(screen.getByText('Only 3 left')).toBeTruthy();
    expect(screen.getByLabelText('Low stock, only 3 left')).toBeTruthy();
  });

  it('shows "Sold out" at zero', async () => {
    await renderWithTheme(<PieceBadge count={0} />);
    expect(screen.getByText('Sold out')).toBeTruthy();
  });

  it('classifies counts', async () => {
    expect(stockStatusOf(0)).toBe('out');
    expect(stockStatusOf(-1)).toBe('out');
    expect(stockStatusOf(2, 2)).toBe('low');
    expect(stockStatusOf(3, 2)).toBe('ok');
    expect(stockStatusOf(1, 0)).toBe('ok');
  });

  it('a recycled cell showing another product gets a fresh pill (no colour fade while scrolling)', async () => {
    const ui = (id: string, count: number) => (
      <AppThemeProvider>
        <PieceBadge testID="badge" subjectId={id} count={count} lowThreshold={2} />
      </AppThemeProvider>
    );
    const view = await renderWithTheme(<PieceBadge testID="badge" subjectId="a" count={0} lowThreshold={2} />);
    const first = screen.getByTestId('badge');
    // Same product crosses the low line: same view, so its colour cross-fades.
    await view.rerender(ui('a', 1));
    expect(screen.getByTestId('badge')).toBe(first);
    // The cell is reused for another product: a new view, so the colour snaps.
    await view.rerender(ui('b', 10));
    expect(screen.getByTestId('badge')).not.toBe(first);
    expect(screen.getByText('10 pieces')).toBeTruthy();
  });

  it('list thumbnails (recycled cells) appear without a fade; single images keep it', () => {
    expect(thumbnailTransition(false, 'p1')).toBe(0);
    expect(thumbnailTransition(false, undefined)).toBe(120);
    expect(thumbnailTransition(true, undefined)).toBe(0);
  });
});
