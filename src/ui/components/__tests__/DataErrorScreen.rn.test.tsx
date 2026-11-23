import { fireEvent, screen } from '@testing-library/react-native';

import { DataErrorScreen } from '../DataErrorScreen';
import { renderWithTheme } from './renderWithTheme';

jest.mock('react-native-reanimated', () => require('./reanimatedMock'));

describe('DataErrorScreen (the database could not be opened)', () => {
  it('speaks plainly through i18n, offers Try again, and keeps the raw error behind "Show details"', async () => {
    const onRetry = jest.fn();
    await renderWithTheme(<DataErrorScreen details="SQLITE_CORRUPT: database disk image is malformed" onRetry={onRetry} />);
    expect(screen.getByText('Could not open your shop data.')).toBeTruthy();
    expect(screen.getByText(/still on this phone/)).toBeTruthy();
    expect(screen.queryByText(/SQLITE_CORRUPT/)).toBeNull();
    await fireEvent.press(screen.getByTestId('data-error-details'));
    expect(screen.getByText(/SQLITE_CORRUPT/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('data-error-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
