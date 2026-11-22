import '@/i18n';

import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import Constants from 'expo-constants';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import migrations from '../../drizzle/migrations';
import { db } from '@/db/client';
import { ensureSeedData } from '@/db/seed';
import { recoverInterruptedRestore } from '@/features/backup/photoFolderSwap';
import { cleanupOldExports } from '@/lib/files';
import { ToastProvider } from '@/ui/components/Toast';
import { AppThemeProvider, useTheme } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync();

// Start-up housekeeping, once per launch and before any screen reads photos.
// Both are synchronous and never throw.
recoverInterruptedRestore();
cleanupOldExports();

function Navigator() {
  const { colors, scheme } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, background: colors.bg, card: colors.surface, text: colors.text, primary: colors.primary, border: colors.border },
      }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
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
    if (success) ensureSeedData(db, (Constants.expoConfig?.extra as { ownerWhatsApp?: string } | undefined)?.ownerWhatsApp ?? '');
  }, [success]);

  const ready = fontsLoaded && success;
  useEffect(() => {
    if (ready || error) void SplashScreen.hideAsync();
  }, [ready, error]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Could not open your shop data.{'\n'}{error.message}</Text>
      </View>
    );
  }
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.flex}>
      <KeyboardProvider>
        <AppThemeProvider>
          <ToastProvider>
            <Navigator />
          </ToastProvider>
        </AppThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#FFF8EE' },
  errorText: { color: '#2B1A12', fontSize: 16, textAlign: 'center' },
});
