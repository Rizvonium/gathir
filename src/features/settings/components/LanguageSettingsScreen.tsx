/** /settings/language — English now; Urdu (RTL) and Hindi are shown as coming in 1.1 (PLAN §12). */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, Icon } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { SubScreen } from './SubScreen';

const LANGUAGES = [
  { code: 'en', key: 'language.english', ready: true },
  { code: 'ur', key: 'language.urdu', ready: false },
  { code: 'hi', key: 'language.hindi', ready: false },
] as const;

export function LanguageSettingsScreen() {
  const { t } = useTranslation('settings');
  const { space } = useTheme();
  return (
    <SubScreen testID="settings-language" title={t('language.title')} subtitle={t('language.subtitle')}>
      <View accessibilityRole="radiogroup" style={{ gap: space.md }}>
        {LANGUAGES.map((l) => {
          const selected = l.code === 'en';
          const status = l.ready ? t('language.current') : t('language.soon');
          return (
            <Card key={l.code} padding="lg">
              <View
                testID={`language-${l.code}`}
                accessible
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: !l.ready }}
                accessibilityLabel={`${t(l.key)}, ${status}`}
                style={[styles.row, { gap: space.md }]}>
                <Icon name={selected ? 'radio-button-checked' : 'radio-button-unchecked'} tone={l.ready ? 'primary' : 'textMuted'} />
                <AppText variant="title" style={styles.flex} muted={!l.ready}>
                  {t(l.key)}
                </AppText>
                <AppText variant="small" muted>
                  {status}
                </AppText>
              </View>
            </Card>
          );
        })}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
});
