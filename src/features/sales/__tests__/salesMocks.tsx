/** Shared module stand-ins for the sales component tests (not a test file itself). */
import type { ReactNode } from 'react';
import { View } from 'react-native';

export const expoUi = {
  Host: ({ children }: { children?: ReactNode }) => <View>{children}</View>,
  BottomSheet: ({ isPresented, children, testID }: { isPresented: boolean; children?: ReactNode; testID?: string }) =>
    isPresented ? <View testID={testID}>{children}</View> : null,
};

export const patterns = {
  PatternPlaceholder: ({ productId }: { productId: string }) => <View testID={`placeholder-${productId}`} />,
  LoomEmptyState: () => <View testID="loom" />,
};

/** Toast stand-in (the real one needs native gesture handler): renders the message and action. */
export function makeToastModule() {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  type Opts = { message: string; actionLabel?: string; onAction?: () => void };
  const Ctx = React.createContext<{ show: (o: Opts) => string; hide: () => void } | null>(null);
  function ToastProvider({ children }: { children: ReactNode }) {
    const [toast, setToast] = React.useState<Opts | null>(null);
    const [api] = React.useState(() => ({ show: (o: Opts) => (setToast(o), 'id'), hide: () => setToast(null) }));
    return (
      <Ctx value={api}>
        {children}
        {toast ? <Text>{toast.message}</Text> : null}
        {toast?.actionLabel ? (
          <Pressable accessibilityRole="button" accessibilityLabel={toast.actionLabel} onPress={() => (setToast(null), toast.onAction?.())} />
        ) : null}
      </Ctx>
    );
  }
  const useToast = () => {
    const api = React.use(Ctx);
    if (!api) throw new Error('no toast provider');
    return api;
  };
  return { ToastProvider, useToast };
}
