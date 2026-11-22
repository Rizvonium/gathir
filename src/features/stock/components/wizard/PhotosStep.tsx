import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Icon } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import type { ProductWizard } from '../../hooks/useProductWizard';
import { MAX_DRAFT_PHOTOS, movePhoto, removePhoto } from '../../logic/draft';
import { PhotoGrid } from './PhotoGrid';

/** Step 1: camera first, gallery second; reorder by drag or by the photo menu. */
export function PhotosStep({ w }: { w: ProductWizard }) {
  const { colors, space, radius } = useTheme();
  const { t } = useTranslation('stock');
  const [width, setWidth] = useState(0);
  const { photos } = w.draft;
  const full = w.room <= 0;

  return (
    <View testID="wizard-photos" style={{ gap: space.lg }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.tip, { backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: space.md, gap: space.sm }]}>
        <Icon name="wb-sunny" tone="lowText" />
        <AppText weight="medium" style={styles.flex}>
          {t('wizard.photos.tip')}
        </AppText>
      </View>
      <View style={{ gap: space.sm }}>
        <Button
          testID="wizard-camera"
          label={t('wizard.photos.camera')}
          icon="photo-camera"
          size="lg"
          fullWidth
          disabled={full}
          loading={w.busy === 'photos'}
          onPress={() => void w.takePhoto()}
        />
        <Button
          testID="wizard-gallery"
          label={t('wizard.photos.gallery')}
          icon="photo-library"
          variant="secondary"
          size="lg"
          fullWidth
          disabled={full || w.busy === 'photos'}
          onPress={() => void w.pickPhotos()}
        />
      </View>
      <AppText variant="small" muted accessibilityLiveRegion="polite">
        {full ? t('wizard.photos.full') : t('wizard.photos.count', { count: photos.length, max: MAX_DRAFT_PHOTOS })}
      </AppText>
      {photos.length === 0 ? (
        <AppText muted>{t('wizard.photos.empty')}</AppText>
      ) : (
        <>
          <PhotoGrid
            photos={photos}
            width={width}
            onMove={(from, to) => w.update((d) => movePhoto(d, from, to))}
            onRemove={(fileName) => w.update((d) => removePhoto(d, fileName))}
          />
          {photos.length > 1 ? (
            <AppText variant="caption" muted>
              {t('wizard.photos.dragHint')}
            </AppText>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tip: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
