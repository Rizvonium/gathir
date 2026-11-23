/**
 * Shows `children` only after the PIN is entered (when a PIN is set). Used for settings that
 * must not be changed by someone else holding the phone, e.g. the owner's WhatsApp number.
 */
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDbQuery } from '@/db/hooks';

import { readPinFlag } from '../pinFlag';
import { PinVerifyPanel } from './PinVerifyPanel';

export function PinGate({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: string }) {
  const pinSet = useDbQuery(readPinFlag, [], { tables: ['shop_settings'] });
  const [ok, setOk] = useState(false);
  if (!pinSet || ok) return <>{children}</>;
  return (
    <View style={styles.center}>
      <PinVerifyPanel testID="pin-gate" title={title} subtitle={subtitle} onSuccess={() => setOk(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, justifyContent: 'center', paddingVertical: 16 },
});
