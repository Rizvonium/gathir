/** Page frame for More → sub-screens: back button, big title, scrolling body, optional sticky footer. */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { IconButton, Screen } from '@/ui/components';

export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/more');
}

export function SubScreen({
  title,
  subtitle,
  children,
  footer,
  actions,
  scroll = true,
  testID,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
  scroll?: boolean;
  testID?: string;
}) {
  const { t } = useTranslation('settings');
  return (
    <Screen
      testID={testID}
      title={title}
      subtitle={subtitle}
      scroll={scroll}
      footer={footer}
      edges={['top', 'bottom']}
      actions={actions}
      leading={<IconButton icon="arrow-back" accessibilityLabel={t('back')} onPress={goBack} />}>
      {children}
    </Screen>
  );
}
