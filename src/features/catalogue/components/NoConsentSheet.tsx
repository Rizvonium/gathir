/** Asked before sending a catalogue or card to a customer who said no to them (PLAN §15). */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppSheet, AppText, Button } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export function NoConsentSheet({ name, onCancel, onSend }: { name: string | null; onCancel: () => void; onSend: () => void }) {
  const { t } = useTranslation('catalogue');
  const { space } = useTheme();
  return (
    <AppSheet visible={name !== null} onClose={onCancel} title={name ? t('consent.title', { name }) : undefined} testID="no-consent-sheet">
      <View style={{ gap: space.md }}>
        <AppText>{t('consent.body')}</AppText>
        <Button testID="consent-cancel" label={t('consent.cancel')} size="lg" fullWidth onPress={onCancel} />
        <Button testID="consent-send-anyway" label={t('consent.sendAnyway')} icon="send" variant="ghost" size="lg" fullWidth onPress={onSend} />
      </View>
    </AppSheet>
  );
}
