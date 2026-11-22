import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, EmptyState, IconButton, ProgressDots, Screen, Skeleton } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { useProductWizard } from '../../hooks/useProductWizard';
import { WIZARD_STEPS } from '../../logic/draft';
import { ColoursStep } from './ColoursStep';
import { DetailsStep } from './DetailsStep';
import { PhotosStep } from './PhotosStep';

const STEP_KEYS = ['photos', 'details', 'colours'] as const;

/** Add / Edit product in three short steps with an auto-saved draft (PLAN §4.5). */
export function ProductWizardScreen({ productId }: { productId?: string }) {
  const { space } = useTheme();
  const { t } = useTranslation('stock');
  const w = useProductWizard(productId);
  const step = w.draft.step;
  const last = step === WIZARD_STEPS - 1;
  const title = w.editing ? t('wizard.editTitle') : t('wizard.newTitle');

  if (w.missing) {
    return (
      <Screen title={title} leading={<IconButton icon="close" accessibilityLabel={t('wizard.close')} onPress={w.close} />}>
        <EmptyState title={t('detail.notFoundTitle')} body={t('detail.notFoundBody')} />
      </Screen>
    );
  }

  const footer = (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      {step > 0 ? <Button label={t('wizard.back')} icon="arrow-back" variant="secondary" size="lg" onPress={w.back} testID="wizard-back" /> : null}
      {w.editing && !last ? (
        <Button label={t('wizard.save')} variant="tonal" size="lg" onPress={w.save} loading={w.busy === 'save'} testID="wizard-save-early" />
      ) : null}
      <Button
        testID="wizard-next"
        label={last ? t('wizard.saveProduct') : t('wizard.next')}
        icon={last ? 'check' : 'arrow-forward'}
        size="lg"
        onPress={w.next}
        loading={last && w.busy === 'save'}
        disabled={w.busy === 'photos'}
        style={{ flex: 1 }}
      />
    </View>
  );

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      title={title}
      subtitle={t(`wizard.steps.${STEP_KEYS[step]}`)}
      leading={<IconButton icon={step === 0 ? 'close' : 'arrow-back'} accessibilityLabel={step === 0 ? t('wizard.close') : t('wizard.back')} onPress={w.back} />}
      actions={w.canDiscard ? <IconButton icon="delete-outline" accessibilityLabel={t('wizard.discard')} onPress={w.discard} testID="wizard-discard" /> : undefined}
      footer={footer}>
      <View style={{ gap: space.xs }}>
        <ProgressDots total={WIZARD_STEPS} current={step} />
        <AppText variant="caption" muted importantForAccessibility="no">
          {t('ui:progress.step', { current: step + 1, total: WIZARD_STEPS })}
        </AppText>
      </View>
      {!w.ready ? (
        <Skeleton height={240} rounded="card" />
      ) : step === 0 ? (
        <PhotosStep w={w} />
      ) : step === 1 ? (
        <DetailsStep w={w} />
      ) : (
        <ColoursStep w={w} />
      )}
    </Screen>
  );
}
