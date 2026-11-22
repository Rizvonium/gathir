/**
 * Mock factories shared by the stock component tests (not a test file). Use from a test with
 * `jest.mock('<module>', () => require('./stockMocks').<name>)`.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';

type ListProps<T> = {
  data: T[];
  renderItem: (info: { item: T; index: number }) => ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  ListHeaderComponent?: ReactNode;
  ListEmptyComponent?: ReactNode;
  ListFooterComponent?: ReactNode;
};

/** FlashList stand-in: renders every row (no virtualisation in tests). */
export const flashList = {
  FlashList: <T,>({ data, renderItem, keyExtractor, ListHeaderComponent, ListEmptyComponent, ListFooterComponent }: ListProps<T>) => (
    <View>
      {ListHeaderComponent}
      {data.length === 0
        ? ListEmptyComponent
        : data.map((item, index) => <View key={keyExtractor ? keyExtractor(item, index) : String(index)}>{renderItem({ item, index })}</View>)}
      {ListFooterComponent}
    </View>
  ),
};

/** @expo/ui: sheets render their children only while presented. */
export const expoUi = {
  Host: ({ children }: { children?: ReactNode }) => <View>{children}</View>,
  BottomSheet: ({ isPresented, children, testID }: { isPresented: boolean; children?: ReactNode; testID?: string }) =>
    isPresented ? <View testID={testID}>{children}</View> : null,
  Switch: ({ value, onValueChange, testID }: { value: boolean; onValueChange: (v: boolean) => void; testID?: string }) => {
    const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Pressable testID={testID} accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onValueChange(!value)} />;
  },
};

/** Gesture Handler: detectors pass children through; gesture hooks return inert objects. */
export const gestureHandler = {
  GestureDetector: ({ children }: { children: ReactNode }) => children,
  GestureHandlerRootView: ({ children }: { children: ReactNode }) => <View>{children}</View>,
  usePanGesture: () => ({}),
  usePinchGesture: () => ({}),
  useTapGesture: () => ({}),
  useSimultaneousGestures: () => ({}),
};

export const swipeable = {
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <View>{children}</View>,
  SwipeDirection: { LEFT: 'left', RIGHT: 'right' },
};

/** Skia art cannot run under Jest. */
export const patterns = {
  PatternPlaceholder: ({ accessibilityLabel }: { accessibilityLabel?: string }) => <View accessibilityLabel={accessibilityLabel} />,
  LoomEmptyState: () => <View />,
};

export const photos = {
  thumbUri: (n: string) => `file:///thumbs/${n}`,
  photoUri: (n: string) => `file:///photos/${n}`,
  deletePhotoFiles: jest.fn(() => 0),
  pickFromCamera: jest.fn(async () => ({ status: 'cancelled' })),
  pickFromGallery: jest.fn(async () => ({ status: 'cancelled' })),
  recoverPendingPick: jest.fn(async () => null),
  savePhoto: jest.fn(),
  sampleColourFromImage: jest.fn(async () => null),
};

export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};

/** Renders a stock screen with the app theme, safe-area metrics and the toast host. */
export async function renderScreen(ui: ReactNode) {
  const { SafeAreaProvider } = jest.requireActual<typeof import('react-native-safe-area-context')>('react-native-safe-area-context');
  const { ToastProvider } = jest.requireActual<typeof import('@/ui/components/Toast')>('@/ui/components/Toast');
  const { renderWithTheme } = jest.requireActual<typeof import('@/ui/components/__tests__/renderWithTheme')>(
    '@/ui/components/__tests__/renderWithTheme',
  );
  return renderWithTheme(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ToastProvider>{ui}</ToastProvider>
    </SafeAreaProvider>,
  );
}
