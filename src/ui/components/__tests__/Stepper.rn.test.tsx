import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { AppThemeProvider } from '@/ui/theme';

import { Stepper } from '../Stepper';
import { renderWithTheme } from './renderWithTheme';

jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...a: unknown[]) => void, ...a: unknown[]) => fn(...a) }));
jest.mock('react-native-reanimated', () => require('./reanimatedMock'));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

function Harness({ initial, min, max, onChange }: { initial: number; min?: number; max?: number; onChange?: (n: number) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <Stepper
      testID="stepper"
      accessibilityLabel="Red pieces"
      value={value}
      min={min}
      max={max}
      onChange={(n) => {
        setValue(n);
        onChange?.(n);
      }}
    />
  );
}

const valueNow = () => screen.getByTestId('stepper-value').props.accessibilityValue.now as number;

describe('Stepper', () => {
  it('increments and decrements by one per tap', async () => {
    const onChange = jest.fn();
    await renderWithTheme(<Harness initial={3} onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('Add one, Red pieces'));
    expect(valueNow()).toBe(4);
    await fireEvent.press(screen.getByLabelText('Remove one, Red pieces'));
    await fireEvent.press(screen.getByLabelText('Remove one, Red pieces'));
    expect(valueNow()).toBe(2);
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([4, 3, 2]);
  });

  it('never goes below min or above max', async () => {
    const onChange = jest.fn();
    await renderWithTheme(<Harness initial={1} min={0} max={2} onChange={onChange} />);
    const minus = screen.getByLabelText('Remove one, Red pieces');
    await fireEvent.press(minus);
    await fireEvent.press(minus);
    expect(valueNow()).toBe(0);
    const plus = screen.getByLabelText('Add one, Red pieces');
    await fireEvent.press(plus);
    await fireEvent.press(plus);
    await fireEvent.press(plus);
    expect(valueNow()).toBe(2);
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([0, 1, 2]);
  });

  it('disables the button at a bound', async () => {
    await renderWithTheme(<Harness initial={0} min={0} max={5} />);
    expect(screen.getByLabelText('Remove one, Red pieces')).toBeDisabled();
    expect(screen.getByLabelText('Add one, Red pieces')).toBeEnabled();
  });

  it('supports TalkBack increment/decrement actions', async () => {
    await renderWithTheme(<Harness initial={5} max={6} />);
    const adjustable = screen.getByTestId('stepper-value');
    await fireEvent(adjustable, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(valueNow()).toBe(6);
    await fireEvent(adjustable, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(valueNow()).toBe(6);
    await fireEvent(adjustable, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(valueNow()).toBe(5);
  });

  it('is controlled: taps step from the value prop, so a parent that keeps its value resets the stepper', async () => {
    const onChange = jest.fn();
    const ui = (value: number) => <Stepper testID="stepper" accessibilityLabel="Red pieces" value={value} onChange={onChange} />;
    const view = await renderWithTheme(ui(5));
    const themed = (value: number) => <AppThemeProvider>{ui(value)}</AppThemeProvider>;
    const minus = screen.getByLabelText('Remove one, Red pieces');
    // The parent does not apply "−" (e.g. it asks for a reason first, then the user cancels).
    await fireEvent.press(minus);
    await fireEvent.press(minus);
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([4, 4]);
    expect(valueNow()).toBe(5);
    // The parent sets a new value: the next step starts from it.
    await view.rerender(themed(9));
    await fireEvent.press(screen.getByLabelText('Add one, Red pieces'));
    expect(onChange).toHaveBeenLastCalledWith(10);
    expect(valueNow()).toBe(9);
  });
});
