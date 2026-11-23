/**
 * Module stand-ins for the catalogue and showroom component tests (not a test file).
 * Use with `jest.mock('<module>', () => require('./catalogueMocks').<name>)`.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';

type ListProps<T> = {
  data: T[];
  renderItem: (info: { item: T; index: number }) => ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  ListHeaderComponent?: ReactNode;
  ListEmptyComponent?: ReactNode;
};

/** FlashList stand-in: renders every row. */
export const flashList = {
  FlashList: <T,>({ data, renderItem, keyExtractor, ListHeaderComponent, ListEmptyComponent }: ListProps<T>) => (
    <View>
      {ListHeaderComponent}
      {data.length === 0
        ? ListEmptyComponent
        : data.map((item, index) => <View key={keyExtractor ? keyExtractor(item, index) : String(index)}>{renderItem({ item, index })}</View>)}
    </View>
  ),
};

export const expoUi = {
  Host: ({ children }: { children?: ReactNode }) => <View>{children}</View>,
  BottomSheet: ({ isPresented, children, testID }: { isPresented: boolean; children?: ReactNode; testID?: string }) =>
    isPresented ? <View testID={testID}>{children}</View> : null,
  Switch: () => <View />,
};

/** Skia art cannot run under Jest. */
export const patterns = {
  PatternPlaceholder: ({ productId }: { productId: string }) => <View testID={`placeholder-${productId}`} />,
  LoomEmptyState: () => <View />,
  PatternHeader: () => <View />,
  PaisleyConfetti: () => <View testID="confetti" />,
  patternInks: () => ['#C62F17', '#F4A300'],
  inkAt: (inks: string[]) => inks[0],
};

export const skia = {
  Canvas: ({ children }: { children?: ReactNode }) => <View>{children}</View>,
  Path: () => <View />,
  Skia: { Path: { Circle: () => ({}) } },
};

/** Toast stand-in that renders the latest message. */
export function makeToastModule() {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  type Opts = { message: string };
  const Ctx = React.createContext<{ show: (o: Opts) => string; hide: () => void } | null>(null);
  function ToastProvider({ children }: { children: ReactNode }) {
    const [toast, setToast] = React.useState<Opts | null>(null);
    const [api] = React.useState(() => ({ show: (o: Opts) => (setToast(o), 'id'), hide: () => setToast(null) }));
    return (
      <Ctx value={api}>
        {children}
        {toast ? <Text>{toast.message}</Text> : null}
      </Ctx>
    );
  }
  const useToast = () => {
    const api = React.use(Ctx);
    if (!api) throw new Error('no toast provider');
    return api;
  };
  // AppSheet renders the in-sheet toast outlet; this stand-in shows toasts at the root only.
  return { ToastProvider, useToast, ToastOutlet: () => null };
}

export function product(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    code: `GTH-${id}`,
    name: `Shawl ${id}`,
    categoryId: 'cat1',
    categoryName: 'Shawls',
    craft: 'Kani',
    material: 'Pashmina',
    size: '',
    ratePaise: 650_000,
    oneOfAKind: false,
    isSample: false,
    createdAt: 0,
    totalPieces: 4,
    status: 'in',
    colours: [{ id: `${id}-red`, name: 'Red', hex: '#C0262D', pieces: 4 }],
    coverThumb: null,
    coverFile: null,
    ...over,
  };
}
