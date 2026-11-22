import { screen } from '@testing-library/react-native';

import { PieceBadge } from '../PieceBadge';
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
});
