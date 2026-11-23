/**
 * Shown when the shop's database cannot be opened at launch (the most stressful state in the
 * app). Plain words and one next step; the technical message stays behind "Show details".
 * Rendered outside the router, toasts and the app lock: needs only the theme.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';

export type DataErrorScreenProps = {
  /** The raw error, shown only after "Show details". */
  details?: string;
  /** Tries to open the data again. */
  onRetry: () => void;
};

export function DataErrorScreen({ details, onRetry }: DataErrorScreenProps) {
  const { t } = useTranslation('common');
  const { colors, space } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.root, { padding: space.xl, gap: space.md }]} testID="data-error">
      <Icon name="error-outline" size={48} tone="danger" />
      <AppText variant="title" align="center" accessibilityRole="header">
        {t('errors.dbFailed')}
      </AppText>
      <AppText align="center">{t('errors.dbFailedBody')}</AppText>
      <View style={[styles.stretch, { gap: space.sm, marginTop: space.md }]}>
        <Button testID="data-error-retry" label={t('actions.retry')} icon="refresh" size="lg" fullWidth onPress={onRetry} />
        {details ? (
          <Button
            testID="data-error-details"
            label={open ? t('errors.hideDetails') : t('errors.showDetails')}
            variant="ghost"
            fullWidth
            onPress={() => setOpen((v) => !v)}
          />
        ) : null}
      </View>
      {open && details ? (
        <AppText variant="small" muted selectable align="center">
          {details}
        </AppText>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  stretch: { alignSelf: 'stretch' },
});
