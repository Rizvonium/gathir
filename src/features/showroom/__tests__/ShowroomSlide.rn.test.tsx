import { renderWithTheme } from '@/ui/components/__tests__/renderWithTheme';
import { AppThemeProvider } from '@/ui/theme';

import { ShowroomSlide } from '../components/ShowroomSlide';

const mockRepeat = jest.fn(<T,>(v: T) => v);
const mockCancel = jest.fn();
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('@/ui/components/__tests__/reanimatedMock'),
  withRepeat: (v: unknown) => mockRepeat(v),
  cancelAnimation: (v: unknown) => mockCancel(v),
}));
jest.mock('@shopify/react-native-skia', () => require('../../catalogue/__tests__/catalogueMocks').skia);
jest.mock('react-native-gesture-handler', () => require('../../stock/__tests__/stockMocks').gestureHandler);
jest.mock('@/ui/patterns', () => require('../../stock/__tests__/stockMocks').patterns);

const product = require('../../catalogue/__tests__/catalogueMocks').product;

const slide = (onScreen: boolean, active = true) => (
  <ShowroomSlide product={product('p1')} index={0} width={400} height={800} active={active} onScreen={onScreen} reducedMotion={false} onZoomChange={jest.fn()} />
);

describe('ShowroomSlide Ken Burns drift', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stops while another screen covers the Showroom and starts again on return', async () => {
    const view = await renderWithTheme(slide(true));
    expect(mockRepeat).toHaveBeenCalledTimes(1);
    mockCancel.mockClear();

    await view.rerender(<AppThemeProvider>{slide(false)}</AppThemeProvider>);
    expect(mockCancel).toHaveBeenCalled();
    expect(mockRepeat).toHaveBeenCalledTimes(1);

    await view.rerender(<AppThemeProvider>{slide(true)}</AppThemeProvider>);
    expect(mockRepeat).toHaveBeenCalledTimes(2);
  });

  it('never starts on a covered screen', async () => {
    await renderWithTheme(slide(false));
    expect(mockRepeat).not.toHaveBeenCalled();
  });
});
