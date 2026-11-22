import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { MoneyInput } from '../MoneyInput';
import { renderWithTheme } from './renderWithTheme';

jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...a: unknown[]) => void, ...a: unknown[]) => fn(...a) }));
jest.mock('react-native-reanimated', () => require('./reanimatedMock'));

function Harness({ initial, onChange }: { initial: number | null; onChange: (p: number | null) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <MoneyInput
      label="Rate"
      value={value}
      onChange={(p) => {
        setValue(p);
        onChange(p);
      }}
    />
  );
}

describe('MoneyInput', () => {
  it('reports paise and shows Indian grouping as you type', async () => {
    const onChange = jest.fn();
    await renderWithTheme(<Harness initial={null} onChange={onChange} />);
    const input = screen.getByLabelText('Rate');
    await fireEvent.changeText(input, '125000');
    expect(onChange).toHaveBeenLastCalledWith(12_500_000);
    expect(input.props.value).toBe('1,25,000');
  });

  it('keeps up to two decimals', async () => {
    const onChange = jest.fn();
    await renderWithTheme(<Harness initial={null} onChange={onChange} />);
    const input = screen.getByLabelText('Rate');
    await fireEvent.changeText(input, '6500.505');
    expect(input.props.value).toBe('6,500.50');
    expect(onChange).toHaveBeenLastCalledWith(650_050);
  });

  it('reports null when cleared and ignores letters', async () => {
    const onChange = jest.fn();
    await renderWithTheme(<Harness initial={650_000} onChange={onChange} />);
    const input = screen.getByLabelText('Rate');
    expect(input.props.value).toBe('6,500');
    await fireEvent.changeText(input, 'abc');
    expect(input.props.value).toBe('');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('shows the rupee prefix', async () => {
    await renderWithTheme(<Harness initial={null} onChange={jest.fn()} />);
    expect(screen.getByText('₹')).toBeTruthy();
  });
});
