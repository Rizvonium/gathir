/**
 * /showroom/leave: the lock screen goes here after a correct PIN. Pops itself and the Showroom,
 * back to where the seller opened it (Home when the Showroom was the first screen).
 * Reached any other way while a Showroom is open (e.g. a gathir:// link), it only pops itself:
 * the Showroom stays, and nothing behind it shows.
 */
import { router, useNavigation } from 'expo-router';
import { useEffect } from 'react';

import { screensToLeave } from '../logic/leave';
import { consumeShowroomLeave } from '../logic/session';

export function useLeaveShowroom(): void {
  const navigation = useNavigation();
  useEffect(() => {
    if (!consumeShowroomLeave()) {
      if (router.canGoBack()) router.back();
      else router.replace('/showroom');
      return;
    }
    const names = navigation.getState()?.routes.map((r) => r.name) ?? [];
    const count = screensToLeave(names);
    if (count !== null) router.dismiss(count);
    else router.replace('/');
  }, [navigation]);
}
