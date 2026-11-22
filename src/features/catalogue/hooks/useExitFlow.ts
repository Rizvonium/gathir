import { router, useNavigation } from 'expo-router';

/**
 * Leaves the whole /catalogue stack (back to where the flow was opened: Home, Stock,
 * a customer, Showroom). Falls back to Home when there is nothing to go back to.
 */
export function useExitFlow(): () => void {
  const navigation = useNavigation();
  return () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };
}
