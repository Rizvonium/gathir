/**
 * /showroom/leave: reached only from the lock screen after a correct PIN. Pops itself and the
 * Showroom, back to where the seller opened it (Home when the Showroom was the first screen).
 */
import { router, useNavigation } from 'expo-router';
import { useEffect } from 'react';

import { screensToLeave } from '../logic/leave';

export function useLeaveShowroom(): void {
  const navigation = useNavigation();
  useEffect(() => {
    const names = navigation.getState()?.routes.map((r) => r.name) ?? [];
    const count = screensToLeave(names);
    if (count !== null) router.dismiss(count);
    else router.replace('/');
  }, [navigation]);
}
