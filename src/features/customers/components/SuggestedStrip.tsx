import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { SuggestedProduct } from '@/db/repo/customerQueries';
import { formatINR } from '@/lib/money';
import { thumbUri } from '@/lib/photos';
import { AppText, Button, Icon, PressableScale, SectionHeader, Thumbnail } from '@/ui/components';
import { PatternPlaceholder } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

const CARD_W = 132;
const PHOTO_H = 164;

export type SuggestedStripProps = {
  items: SuggestedProduct[];
  /** True when the customer has no likes and no purchases yet (nothing to match on). */
  nothingToMatch: boolean;
  onOpen: (productId: string) => void;
  onSend: (productIds: string[]) => void;
  /** Designs already in their personal catalogue (shown as added). */
  inCatalogue?: ReadonlySet<string>;
  /** "Add to their catalogue" under each suggestion; omit to hide the button. */
  onAddToCatalogue?: (productId: string) => void;
};

/** "Suggested for them": in-stock designs matching their likes, then one tap to send as a catalogue. */
export function SuggestedStrip({ items, nothingToMatch, onOpen, onSend, inCatalogue, onAddToCatalogue }: SuggestedStripProps) {
  const { space, radius } = useTheme();
  const { t } = useTranslation('customers');

  return (
    <View style={{ gap: space.sm }}>
      <SectionHeader title={t('suggested.title')} />
      {items.length === 0 ? (
        <AppText muted>{nothingToMatch ? t('suggested.needLikes') : t('suggested.none')}</AppText>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -space.lg }}
            contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}>
            {items.map((p) => (
              <View key={p.id} style={{ width: CARD_W, gap: space.xs }}>
                <PressableScale
                  testID={`suggested-${p.id}`}
                  onPress={() => onOpen(p.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('suggested.itemLabel', { name: p.name, rate: formatINR(p.ratePaise) })}
                  style={{ width: CARD_W, gap: space.xs }}>
                  {p.coverThumb ? (
                    <Thumbnail uri={thumbUri(p.coverThumb)} rounded="card" style={{ width: CARD_W, height: PHOTO_H }} />
                  ) : (
                    <PatternPlaceholder productId={p.id} name={p.name} width={CARD_W} height={PHOTO_H} radius={radius.card} />
                  )}
                  <AppText variant="small" weight="semibold" numberOfLines={2}>
                    {p.name}
                  </AppText>
                  <AppText variant="small" numeric>
                    {formatINR(p.ratePaise)}
                  </AppText>
                  <AppText variant="caption" numberOfLines={1} muted>
                    {p.reasons.map((r) => t(`suggested.reasons.${r}`)).join(' · ')}
                  </AppText>
                </PressableScale>
                {onAddToCatalogue ? (
                  inCatalogue?.has(p.id) ? (
                    <View style={[styles.added, { gap: space.xs, minHeight: 48 }]} accessible accessibilityLabel={t('suggested.inCatalogueLabel', { name: p.name })}>
                      <Icon name="check-circle" size={18} tone="meadow" />
                      <AppText variant="caption" weight="semibold" style={styles.flex}>
                        {t('suggested.inCatalogue')}
                      </AppText>
                    </View>
                  ) : (
                    <Button
                      testID={`suggested-add-${p.id}`}
                      label={t('suggested.addToCatalogue')}
                      icon="playlist-add"
                      size="sm"
                      variant="secondary"
                      accessibilityHint={t('suggested.addToCatalogueHint', { name: p.name })}
                      onPress={() => onAddToCatalogue(p.id)}
                    />
                  )
                ) : null}
              </View>
            ))}
          </ScrollView>
          <Button
            testID="suggested-send"
            label={t('suggested.sendCount', { count: items.length })}
            icon="picture-as-pdf"
            variant="tonal"
            onPress={() => onSend(items.map((p) => p.id))}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  added: { flexDirection: 'row', alignItems: 'center' },
});
