/**
 * Leaving the Showroom is deliberate (PLAN §4.9): hold the corner mark 1.5 s, then the PIN when
 * one is set. The Android back button never leaves silently: it only shows how to leave.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

import { SHOWROOM_LEAVE_PATH } from '../logic/leave';

export function useShowroomExit({ pinSet, onBackBlocked }: { pinSet: boolean; onBackBlocked: () => void }) {
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        onBackBlocked();
        return true;
      });
      return () => sub.remove();
    }, [onBackBlocked]),
  );

  return () => {
    if (pinSet) {
      // Pushed, not replaced: closing the lock screen (or Android back there) returns to the
      // Showroom, never past it. A correct PIN goes to /showroom/leave, which closes the Showroom.
      router.push({ pathname: '/lock', params: { mode: 'verify', returnTo: SHOWROOM_LEAVE_PATH } });
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };
}
