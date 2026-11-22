import { Host, Switch } from '@expo/ui';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { sampleColourFromImage } from '@/lib/photos';
import { formatINR } from '@/lib/money';
import { AppText, Button, ColourSwatch, Divider, IconButton, MoneyInput, Stepper, TextField } from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { shawlSwatches } from '@/ui/tokens';

import type { ProductWizard } from '../../hooks/useProductWizard';
import {
  addColour,
  costWarnings,
  findColour,
  removeColour,
  setColourCost,
  setColourPieces,
  setOneOfAKind,
  toggleSwatch,
  totalDraftPieces,
  type DraftColour,
} from '../../logic/draft';

/** Neutral swatch for a typed colour when the cover photo cannot be sampled. */
const FALLBACK_HEX = shawlSwatches.find((s) => s.key === 'grey')?.hex ?? '#8E8E93';

/** Step 3: tap swatches (1 piece each), adjust pieces with big steppers, or mark One of a kind. */
export function ColoursStep({ w }: { w: ProductWizard }) {
  const { colors, space, radius } = useTheme();
  const { t } = useTranslation('stock');
  const d = w.draft;
  const [custom, setCustom] = useState('');
  const [photoHex, setPhotoHex] = useState<string | null>(null);
  // Colours whose "Different buying price?" field is open (open from the start when one is set).
  const [costOpen, setCostOpen] = useState<Set<string>>(() => new Set(d.colours.filter((c) => c.costPaise != null).map((c) => c.key)));
  const warn = costWarnings(d);
  const cover = d.photos[0]?.thumbName;

  // "Photo colour": a typed colour gets the cover photo's main colour as its swatch.
  useEffect(() => {
    if (!cover) return;
    let alive = true;
    void sampleColourFromImage(cover).then((hex) => {
      if (alive) setPhotoHex(hex);
    });
    return () => {
      alive = false;
    };
  }, [cover]);

  const addCustom = () => {
    const name = custom.trim();
    if (!name) return;
    w.update((cur) => addColour(cur, name, photoHex ?? FALLBACK_HEX));
    setCustom('');
  };

  const total = totalDraftPieces(d);

  return (
    <View style={{ gap: space.xl }}>
      <View style={[styles.row, { gap: space.md, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card, padding: space.lg }]}>
        <View style={styles.flex}>
          <AppText weight="semibold">{t('wizard.colours.oneOfAKind')}</AppText>
          <AppText variant="small" muted>
            {t('wizard.colours.oneOfAKindHelp')}
          </AppText>
        </View>
        <Host matchContents>
          <Switch
            testID="wizard-one-of-a-kind"
            value={d.oneOfAKind}
            onValueChange={(on) => w.update((cur) => setOneOfAKind(cur, on))}
          />
        </Host>
      </View>

      <View style={{ gap: space.md }}>
        <AppText variant="small" weight="semibold" muted>
          {d.oneOfAKind ? t('wizard.colours.oneOfAKindPick') : t('wizard.colours.pick')}
        </AppText>
        <View style={[styles.swatches, { gap: space.md }]}>
          {shawlSwatches.map((s) => (
            <ColourSwatch
              key={s.key}
              testID={`swatch-${s.key}`}
              hex={s.hex}
              name={s.name}
              size={40}
              showName
              selected={!!findColour(d, s.name)}
              onPress={() => w.update((cur) => toggleSwatch(cur, s.name, s.hex))}
            />
          ))}
        </View>
        <View style={[styles.row, { gap: space.sm, alignItems: 'flex-end' }]}>
          <TextField
            label={t('wizard.colours.custom')}
            placeholder={t('wizard.colours.customPlaceholder')}
            value={custom}
            onChangeText={setCustom}
            onSubmitEditing={addCustom}
            returnKeyType="done"
            autoCapitalize="words"
            maxLength={40}
            style={styles.flex}
          />
          <Button label={t('wizard.colours.addCustom')} icon="add" variant="tonal" disabled={!custom.trim()} onPress={addCustom} />
        </View>
      </View>

      <View style={{ gap: space.xs }}>
        <AppText variant="small" weight="semibold" muted>
          {t('wizard.colours.chosen')}
        </AppText>
        {d.colours.length === 0 ? (
          <AppText tone={w.errors.colours ? 'danger' : 'textMuted'} accessibilityLiveRegion="polite">
            {w.errors.colours ? t(`wizard.errors.${w.errors.colours}`) : t('wizard.colours.none')}
          </AppText>
        ) : null}
        {d.colours.map((c, i) => (
          <View key={c.key}>
            {i > 0 ? <Divider /> : null}
            <View style={[styles.row, { gap: space.md, paddingVertical: space.sm, minHeight: 64 }]}>
              <ColourSwatch hex={c.hex} name={c.name} size={32} />
              <AppText weight="semibold" numberOfLines={2} style={styles.flex}>
                {c.name}
              </AppText>
              {d.oneOfAKind ? (
                <AppText muted>{t('common:pieces', { count: c.pieces })}</AppText>
              ) : (
                <Stepper
                  testID={`wizard-pieces-${c.name}`}
                  size="md"
                  value={c.pieces}
                  onChange={(n) => w.update((cur) => setColourPieces(cur, c.key, n))}
                  accessibilityLabel={t('detail.colourPieces', { name: c.name })}
                />
              )}
              <IconButton icon="close" accessibilityLabel={t('wizard.colours.remove', { name: c.name })} onPress={() => w.update((cur) => removeColour(cur, c.key))} />
            </View>
            {!d.oneOfAKind ? (
              <ColourCost
                colour={c}
                open={costOpen.has(c.key)}
                designCost={d.costPaise}
                belowRate={warn.coloursBelowCost.includes(c.key)}
                onOpen={() => setCostOpen((cur) => new Set(cur).add(c.key))}
                onClose={() => {
                  setCostOpen((cur) => {
                    const next = new Set(cur);
                    next.delete(c.key);
                    return next;
                  });
                  w.update((cur) => setColourCost(cur, c.key, null));
                }}
                onChange={(paise) => w.update((cur) => setColourCost(cur, c.key, paise))}
              />
            ) : null}
          </View>
        ))}
        {d.colours.length > 0 ? (
          <AppText variant="title" weight="bold" numeric style={{ paddingTop: space.sm }}>
            {t('wizard.colours.total', { count: total })}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Folded "Different buying price for Red?" link under a colour (e.g. a newer batch cost more).
 * Seller-only. Closing it goes back to the design's buying price.
 */
function ColourCost({
  colour,
  open,
  designCost,
  belowRate,
  onOpen,
  onClose,
  onChange,
}: {
  colour: DraftColour;
  open: boolean;
  designCost: number | null;
  belowRate: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (paise: number | null) => void;
}) {
  const { t } = useTranslation('stock');
  const { space } = useTheme();
  if (!open) {
    return (
      <Button
        testID={`wizard-colour-cost-open-${colour.name}`}
        label={t('wizard.colours.costOpen', { name: colour.name })}
        icon="sell"
        variant="ghost"
        size="sm"
        onPress={onOpen}
        style={styles.start}
      />
    );
  }
  const same = designCost !== null ? t('wizard.colours.costSame', { cost: formatINR(designCost) }) : t('wizard.colours.costSameNone');
  return (
    <View style={[styles.row, { gap: space.sm, alignItems: 'flex-start', paddingBottom: space.sm }]}>
      <MoneyInput
        testID={`wizard-colour-cost-${colour.name}`}
        label={t('wizard.colours.costLabel', { name: colour.name })}
        value={colour.costPaise ?? null}
        onChange={onChange}
        helper={belowRate ? t('wizard.details.costAboveRate') : same}
        style={styles.flex}
      />
      <IconButton icon="undo" accessibilityLabel={t('wizard.colours.costReset', { name: colour.name })} onPress={onClose} testID={`wizard-colour-cost-reset-${colour.name}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap' },
});
