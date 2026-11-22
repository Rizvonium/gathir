/** A titled group of rows on a card (Android settings style, themed with the bazaar tokens). */
import { Children, Fragment, type ReactNode } from 'react';
import { View } from 'react-native';

import { AppText, Card, Divider } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export function SettingsGroup({ title, footer, children, testID }: { title?: string; footer?: string; children: ReactNode; testID?: string }) {
  const { space } = useTheme();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View testID={testID} style={{ gap: space.sm }}>
      {title ? (
        <AppText variant="small" weight="bold" tone="textMuted" accessibilityRole="header" style={{ paddingHorizontal: space.xs }}>
          {title}
        </AppText>
      ) : null}
      <Card padding="none" style={{ overflow: 'hidden' }}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? <Divider inset={16} /> : null}
            {row}
          </Fragment>
        ))}
      </Card>
      {footer ? (
        <AppText variant="small" muted style={{ paddingHorizontal: space.xs }}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}
