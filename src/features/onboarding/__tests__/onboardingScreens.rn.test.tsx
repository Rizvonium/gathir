import 'react-native-gesture-handler/jestSetup';

import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/ui/components/__tests__/renderWithTheme';

import { AppLockScreen } from '../AppLockScreen';
import { LanguageScreen } from '../LanguageScreen';
import { OwnerScreen } from '../OwnerScreen';
import { ShopScreen } from '../ShopScreen';
import { StartScreen } from '../StartScreen';
import { WelcomeScreen } from '../WelcomeScreen';

jest.mock('react-native-reanimated', () => require('@/ui/components/__tests__/reanimatedMock'));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/ui/patterns', () => {
  const { Pressable, View } = require('react-native');
  return {
    KaniWeaveBackground: () => <View />,
    // Stand-in for the Skia weave: tapping it "skips" to the end, like the real one.
    ThreadWeaveLogo: ({ onDone, skipLabel }: { onDone: () => void; skipLabel: string }) => (
      <Pressable accessibilityRole="button" accessibilityLabel={skipLabel} onPress={onDone} />
    ),
  };
});
jest.mock('@/db/client', () => ({ db: {} }));
const mockToast = jest.fn();
// The real toast uses Gesture Handler v3 hooks, which do not run under Jest.
jest.mock('@/ui/components/Toast', () => ({
  useToast: () => ({ show: mockToast, hide: jest.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
  ToastOutlet: () => null,
}));

const mockDraft = { shopName: '', sellerName: '', phone: '', address: '', upiId: '', ownerWhatsapp: '+919906000999', language: 'en', pinSet: false };
jest.mock('../onboardingData', () => ({
  readOnboardingDraft: jest.fn(() => mockDraft),
  saveLanguage: jest.fn(),
  saveShop: jest.fn(),
  saveOwnerWhatsapp: jest.fn(),
  finishOnboarding: jest.fn(),
}));
let mockOnboarded = false;
jest.mock('../useOnboarded', () => ({ useOnboarded: () => mockOnboarded }));
let mockPinSet = false;
jest.mock('@/db/hooks', () => ({ useDbQuery: () => mockPinSet }));

const data = jest.requireMock('../onboardingData') as Record<string, jest.Mock>;

const render = (ui: React.ReactElement) => renderWithTheme(ui);

beforeEach(() => {
  Object.values(mockRouter).forEach((f) => f.mockClear());
  Object.values(data).forEach((f) => f.mockClear());
  mockOnboarded = false;
  mockPinSet = false;
  mockToast.mockClear();
});

describe('Welcome', () => {
  it('tap skips the weave, then Get started opens the language step', async () => {
    await render(<WelcomeScreen />);
    expect(screen.getByText('Your shop, in your pocket.')).toBeTruthy();
    expect(screen.getByTestId('welcome-start').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByLabelText('Skip the intro'));
    await fireEvent.press(screen.getByTestId('welcome-start'));
    expect(mockRouter.push).toHaveBeenCalledWith('/language');
  });
});

describe('Language step', () => {
  it('English is selected; Urdu and Hindi are coming soon and disabled', async () => {
    await render(<LanguageScreen />);
    expect(screen.getByLabelText('English, selected').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('Urdu, coming soon, not available yet').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByLabelText('Hindi, coming soon, not available yet')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('language-continue'));
    expect(data.saveLanguage).toHaveBeenCalledWith({}, 'en');
    expect(mockRouter.push).toHaveBeenCalledWith('/shop');
  });
});

describe('Shop step', () => {
  it('needs a shop name, then saves the trimmed details and moves on', async () => {
    await render(<ShopScreen />);
    await fireEvent.press(screen.getByTestId('shop-continue'));
    expect(screen.getByText('Type your shop name to continue.')).toBeTruthy();
    expect(data.saveShop).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Shop name'), '  Valley Pashmina ');
    expect(screen.queryByText('Type your shop name to continue.')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('UPI ID'), 'Ali@OKAXIS');
    await fireEvent.press(screen.getByTestId('shop-continue'));
    expect(data.saveShop).toHaveBeenCalledWith({}, { shopName: 'Valley Pashmina', sellerName: '', phone: '', address: '', upiId: 'ali@okaxis' });
    expect(mockRouter.push).toHaveBeenCalledWith('/owner');
  });

  it('rejects a UPI ID that is not name@bank', async () => {
    await render(<ShopScreen />);
    await fireEvent.changeText(screen.getByLabelText('Shop name'), 'Valley');
    await fireEvent.changeText(screen.getByLabelText('UPI ID'), 'alishah');
    await fireEvent.press(screen.getByTestId('shop-continue'));
    expect(screen.getByText('A UPI ID looks like name@bank. Check it or leave it empty.')).toBeTruthy();
    expect(data.saveShop).not.toHaveBeenCalled();
  });
});

describe('Owner step', () => {
  it('is pre-filled from the build and continues with one tap', async () => {
    await render(<OwnerScreen />);
    expect(screen.getByText('This number was set for you. Check it, then continue.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('owner-continue'));
    expect(data.saveOwnerWhatsapp).toHaveBeenCalledWith({}, '+919906000999');
    expect(mockRouter.push).toHaveBeenCalledWith('/app-lock');
  });

  it('after setup (e.g. opened by a gathir://owner link) never saves: hands over to the PIN-gated settings screen', async () => {
    mockOnboarded = true;
    await render(<OwnerScreen />);
    expect(screen.queryByTestId('owner-continue')).toBeNull();
    expect(mockRouter.replace).toHaveBeenCalledWith('/settings/owner');
    expect(data.saveOwnerWhatsapp).not.toHaveBeenCalled();
  });
});

describe('Lock step', () => {
  it('links to set a PIN or skips', async () => {
    await render(<AppLockScreen />);
    await fireEvent.press(screen.getByTestId('lock-set'));
    expect(mockRouter.push).toHaveBeenCalledWith('/lock?mode=set&returnTo=%2Fstart');
    await fireEvent.press(screen.getByTestId('lock-skip'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/start');
  });

  it('after a PIN is set it only offers Continue', async () => {
    mockPinSet = true;
    await render(<AppLockScreen />);
    expect(screen.queryByTestId('lock-set')).toBeNull();
    await fireEvent.press(screen.getByTestId('lock-continue'));
    expect(mockRouter.push).toHaveBeenCalledWith('/start');
  });
});

describe('Start step', () => {
  it('sample products: finishes onboarding with sample data and goes Home', async () => {
    await render(<StartScreen />);
    await fireEvent.press(screen.getByTestId('start-sample'));
    await waitFor(() => expect(data.finishOnboarding).toHaveBeenCalledWith({}, { sample: true }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('add first shawl: goes Home, then opens the add form', async () => {
    await render(<StartScreen />);
    await fireEvent.press(screen.getByTestId('start-add'));
    await waitFor(() => expect(data.finishOnboarding).toHaveBeenCalledWith({}, { sample: false }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
    expect(mockRouter.push).toHaveBeenCalledWith('/product/new');
  });

  it('keeps the seller on the step with a message when finishing fails', async () => {
    data.finishOnboarding.mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    await render(<StartScreen />);
    await fireEvent.press(screen.getByTestId('start-sample'));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith({ message: 'Could not finish setting up. Your details are saved. Try again.', tone: 'danger' }));
    expect(screen.getByTestId('start-sample').props.accessibilityState).toMatchObject({ disabled: false });
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('a restored backup that is already onboarded goes straight Home', async () => {
    mockOnboarded = true;
    await render(<StartScreen />);
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });
});
