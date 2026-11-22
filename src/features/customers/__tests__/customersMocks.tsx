/**
 * Mock factories for the customers component tests (not a test file). Use from a test with
 * `jest.mock('<module>', () => require('./customersMocks').<name>)`.
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import type { CustomerListRow, CustomerProfile } from '@/db/repo/customerQueries';
import type { Customer } from '@/db/schema';

type ListProps<T> = {
  data: T[];
  renderItem: (info: { item: T; index: number }) => ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  ListHeaderComponent?: ReactNode;
  ListEmptyComponent?: ReactNode;
  ListFooterComponent?: ReactNode;
};

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

export const expoUi = {
  Host: ({ children }: { children?: ReactNode }) => <View>{children}</View>,
  BottomSheet: ({ isPresented, children, testID }: { isPresented: boolean; children?: ReactNode; testID?: string }) =>
    isPresented ? <View testID={testID}>{children}</View> : null,
  Switch: ({ value, onValueChange, testID }: { value: boolean; onValueChange: (v: boolean) => void; testID?: string }) => (
    <Pressable testID={testID} accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onValueChange(!value)} />
  ),
};

/** Gesture Handler: detectors pass children through; gesture hooks return inert objects. */
export const gestureHandler = {
  GestureDetector: ({ children }: { children: ReactNode }) => children,
  GestureHandlerRootView: ({ children }: { children: ReactNode }) => <View>{children}</View>,
  usePanGesture: () => ({}),
  useTapGesture: () => ({}),
};

export const datePicker = { DateTimePicker: () => null };

export const patterns = {
  PatternPlaceholder: ({ accessibilityLabel }: { accessibilityLabel?: string }) => <View accessibilityLabel={accessibilityLabel} />,
  LoomEmptyState: () => <View />,
};

export const photos = { thumbUri: (n: string) => `file:///thumbs/${n}`, photoUri: (n: string) => `file:///photos/${n}` };

export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismissTo: jest.fn(),
  canGoBack: jest.fn(() => true),
};

export const share = { openWhatsAppChat: jest.fn(async () => true) };

export function customerRow(o: Partial<CustomerListRow> = {}): CustomerListRow {
  return {
    id: 'c1',
    name: 'Anita Kaul',
    phone: '+919906000104',
    whatsappOk: true,
    city: 'Srinagar',
    tag: 'regular',
    favouriteColour: 'maroon',
    nextFollowUpAt: null,
    createdAt: 0,
    lifetimeSpendPaise: 4_500_000,
    purchases: 3,
    lastVisitAt: Date.now() - 3 * 86_400_000,
    ...o,
  };
}

export function customer(o: Partial<Customer> = {}): Customer {
  return {
    id: 'c1',
    name: 'Anita Kaul',
    phone: '+919906000104',
    whatsappOk: true,
    city: 'Srinagar',
    address: '',
    tag: 'regular',
    notes: '',
    likesJson: '{"colours":[],"crafts":[]}',
    deletedAt: null,
    createdAt: 0,
    updatedAt: 0,
    ...o,
  } as Customer;
}

export function profile(o: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    customer: customer(),
    likes: { colours: ['maroon'], crafts: [] },
    stats: { lifetimeSpendPaise: 4_500_000, purchases: 3, lastVisitAt: Date.now() - 86_400_000, piecesBought: 4 },
    learnedLikes: { crafts: ['Sozni'], colours: ['maroon'], budgetMinPaise: null, budgetMaxPaise: null },
    openFollowUps: [],
    timeline: [],
    ...o,
  };
}

/** Renders with the app theme, safe-area metrics and the toast host. */
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
