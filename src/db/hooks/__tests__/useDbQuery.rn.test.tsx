import { act, render } from '@testing-library/react-native';
import { IsFocusedContext } from 'expo-router/build/react-navigation/core/useIsFocused';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { useDbQuery, type DbQueryOptions } from '../useDbQuery';

const mockListeners: ((e: { tableName: string }) => void)[] = [];
jest.mock('expo-sqlite', () => ({
  addDatabaseChangeListener: (fn: (e: { tableName: string }) => void) => {
    mockListeners.push(fn);
    return { remove: () => undefined };
  },
}));
jest.mock('../../client', () => ({ db: {} }));

/** Fires a change event for `table` and flushes the once-per-frame batch. */
async function write(...tables: string[]) {
  await act(async () => {
    tables.forEach((t) => mockListeners.forEach((l) => l({ tableName: t })));
    jest.runOnlyPendingTimers();
  });
}

function Probe({ query, options, deps = [] }: { query: jest.Mock; options?: DbQueryOptions; deps?: unknown[] }) {
  const value = useDbQuery(query, deps, options);
  return <Text testID="value">{String(value)}</Text>;
}

const focused = (on: boolean, children: ReactNode) => <IsFocusedContext.Provider value={on}>{children}</IsFocusedContext.Provider>;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => setTimeout(() => cb(0), 16) as unknown as number);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useDbQuery', () => {
  it('re-runs once per frame after writes, however many rows changed', async () => {
    const query = jest.fn(() => 1);
    await render(<Probe query={query} />);
    expect(query).toHaveBeenCalledTimes(1);
    await write('colours', 'stock_moves', 'products');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('with tables: re-runs only when one of them changed', async () => {
    const query = jest.fn(() => 1);
    await render(<Probe query={query} options={{ tables: ['shop_settings'] }} />);
    await write('colours', 'stock_moves');
    expect(query).toHaveBeenCalledTimes(1);
    await write('shop_settings');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('does not re-run on an unfocused screen; catches up once when focused again', async () => {
    const query = jest.fn(() => 1);
    const view = await render(focused(false, <Probe query={query} />));
    await write('colours');
    await write('colours');
    await write('sales');
    expect(query).toHaveBeenCalledTimes(1);
    await view.rerender(focused(true, <Probe query={query} />));
    expect(query).toHaveBeenCalledTimes(2);
    await view.rerender(focused(true, <Probe query={query} />));
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('counts as focused outside a route (no focus context)', async () => {
    const query = jest.fn(() => 1);
    await render(<Probe query={query} />);
    await write('sales');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('enabled: false keeps the last result until enabled again', async () => {
    let n = 0;
    const query = jest.fn(() => ++n);
    const view = await render(<Probe query={query} options={{ enabled: false }} />);
    await write('customers');
    await view.rerender(<Probe query={query} options={{ enabled: false }} deps={['changed']} />);
    expect(query).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('value')).toHaveTextContent('1');
    await view.rerender(<Probe query={query} options={{ enabled: true }} deps={['changed']} />);
    expect(query).toHaveBeenCalledTimes(2);
    expect(view.getByTestId('value')).toHaveTextContent('2');
  });
});
