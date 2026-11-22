/** /settings/tags — the customer types (read-only in v1) and how many customers have each. */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDbQuery } from '@/db/hooks';
import { CUSTOMER_TAGS } from '@/db/schema';
import { AppText, ListRow } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { readTagCounts } from '../settingsData';
import { RowIcon } from './RowIcon';
import { SettingsGroup } from './SettingsGroup';
import { SubScreen } from './SubScreen';

const TAG_ICONS = { regular: 'favorite', wholesale: 'local-shipping', tourist: 'flight', walk_in: 'directions-walk', other: 'person' } as const;

export function TagsScreen() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('customers');
  const { space } = useTheme();
  const counts = useDbQuery(readTagCounts, []);
  return (
    <SubScreen testID="settings-tags" title={t('tags.title')} subtitle={t('tags.subtitle')}>
      <SettingsGroup>
        {CUSTOMER_TAGS.map((tag) => (
          <ListRow
            key={tag}
            testID={`tag-${tag}`}
            leading={<RowIcon name={TAG_ICONS[tag]} tone="indigo" />}
            title={tc(`tags.${tag}`)}
            subtitle={t(`tags.hints.${tag}`)}
            trailing={
              <AppText variant="small" muted numeric>
                {t('tags.count', { count: counts[tag] })}
              </AppText>
            }
          />
        ))}
      </SettingsGroup>
      <View style={[styles.note, { paddingHorizontal: space.xs }]}>
        <AppText variant="small" muted>
          {t('tags.later')}
        </AppText>
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({ note: {} });
