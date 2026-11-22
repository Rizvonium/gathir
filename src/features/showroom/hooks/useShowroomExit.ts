/**
 * Leaving the Showroom is deliberate (PLAN §4.9): hold the corner mark 1.5 s, then the PIN when
 * one is set. The Android back button never leaves silently: it only shows how to leave.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

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
      // The lock screen replaces the Showroom; on success it goes back to where the seller was.
      router.replace({ pathname: '/lock', params: { mode: 'verify', returnTo: 'back' } });
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };
}
