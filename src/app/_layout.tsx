import '@/i18n';

import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import Constants from 'expo-constants';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import migrations from '../../drizzle/migrations';
import { db } from '@/db/client';
import { ensureSeedData } from '@/db/seed';
import { recoverInterruptedRestore } from '@/features/backup/photoFolderSwap';
import { useBackupReminderRouting } from '@/features/backup/useBackupReminderRouting';
import { useFollowUpNotificationRouting } from '@/features/customers/followUpNotifications';
import { AppLockGate } from '@/features/lock/AppLockGate';
import { usePendingPickRouting } from '@/features/stock/hooks/usePendingPickRouting';
import { purgeExpiredOnLaunch } from '@/features/stock/logic/purge';
import { cleanupOldExports } from '@/lib/files';
import { deletePhotoFiles } from '@/lib/photos';
import { DataErrorScreen } from '@/ui/components/DataErrorScreen';
import { ToastProvider } from '@/ui/components/Toast';
import { AppThemeProvider, useTheme } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync();

// Start-up housekeeping, once per launch and before any screen reads photos.
// Both are synchronous and never throw.
recoverInterruptedRestore();
cleanupOldExports();

/**
 * Launch routing: follow-up reminder → customer profile, backup reminder → /backup (cold start
 * too), and a photo picked just before Android closed the app → back to the wizard that took it.
 */
function NotificationRouting() {
  useFollowUpNotificationRouting();
  useBackupReminderRouting();
  usePendingPickRouting();
  return null;
}

function Navigator() {
  const { colors, radius, scheme } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, background: colors.bg, card: colors.surface, text: colors.text, primary: colors.primary, border: colors.border },
      }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        {/* Declared here (not only via <Stack.Screen> inside sell.tsx) so the very first
            presentation is already a native form sheet on Android, not a push. */}
        <Stack.Screen
          name="sell"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.92],
            sheetGrabberVisible: true,
            sheetCornerRadius: radius.sheet,
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </Stack>
      <NotificationRouting />
    </ThemeProvider>
  );
}

/** "Try again" on the data error remounts the app root, so the database is opened afresh. */
export default function RootLayout() {
  const [attempt, setAttempt] = useState(0);
  return <AppRoot key={attempt} onRetry={() => setAttempt((n) => n + 1)} />;
}

function AppRoot({ onRetry }: { onRetry: () => void }) {
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    if (!success) return;
    ensureSeedData(db, (Constants.expoConfig?.extra as { ownerWhatsApp?: string } | undefined)?.ownerWhatsApp ?? '');
    // Recently deleted older than 30 days is removed for real on every launch (not only when
    // the seller opens that screen): customers' names, phones and sale snapshots included.
    purgeExpiredOnLaunch(db, deletePhotoFiles);
  }, [success]);

  const ready = fontsLoaded && success;
  useEffect(() => {
    if (ready || error) void SplashScreen.hideAsync();
  }, [ready, error]);

  if (error) {
    // Translated, themed and in plain words; the technical message only behind "Show details".
    return (
      <AppThemeProvider>
        <DataErrorScreen details={error.message} onRetry={onRetry} />
      </AppThemeProvider>
    );
  }
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.flex}>
      <KeyboardProvider>
        <AppThemeProvider>
          <ToastProvider>
            {/* App lock: PIN pad over everything on cold start and after > 5 min away (when a PIN is set). */}
            <AppLockGate>
              <Navigator />
            </AppLockGate>
          </ToastProvider>
        </AppThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
