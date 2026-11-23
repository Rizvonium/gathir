import { render } from '@testing-library/react-native';

import { usePendingPickRouting } from '../hooks/usePendingPickRouting';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
let mockMarker: unknown = null;
jest.mock('../logic/pendingPick', () => ({ readPendingPick: () => mockMarker }));

function Probe() {
  usePendingPickRouting();
  return null;
}

beforeEach(() => {
  mockPush.mockClear();
  mockMarker = null;
});

describe('usePendingPickRouting (cold start after Android closed the app during a pick)', () => {
  it('reopens the Add wizard that opened the camera', async () => {
    mockMarker = { key: 'new', productId: null, at: 1, draft: {} };
    await render(<Probe />);
    expect(mockPush).toHaveBeenCalledWith('/product/new');
  });
  it('reopens the Edit wizard of that product', async () => {
    mockMarker = { key: 'p1', productId: 'p1', at: 1, draft: {} };
    await render(<Probe />);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/product/[id]/edit', params: { id: 'p1' } });
  });
  it('does nothing on a normal launch', async () => {
    await render(<Probe />);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
