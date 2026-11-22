/** /catalogue/options step 2: how the catalogue looks. Everything is pre-filled from last time. */
import { Host, Switch } from '@expo/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatDate } from '@/lib/dates';
import type { CatalogueColumns, CatalogueStyle } from '@/pdf/types';
import { AppText, Button, Chip, ChipGroup, IconButton, PressableScale, Screen, SectionHeader, Skeleton, TextField } from '@/ui/components';
import { palette, touchTarget } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

import { useCatalogueOptions } from '../hooks/useCatalogueOptions';
import { useExitFlow } from '../hooks/useExitFlow';
import { ratesValidTill, VALID_FOR_CHOICES, type CatalogueForm, type ValidForDays } from '../logic/options';

const TITLE_IDEAS = ['winter', 'new', 'wedding', 'festive'] as const;

export function OptionsStep() {
  const { t } = useTranslation('catalogue');
  const { space } = useTheme();
  const exit = useExitFlow();
  const { form, update, remember } = useCatalogueOptions();

  return (
    <Screen
      scroll
      title={t('options.heading')}
      subtitle={t('flow.step', { n: 2 })}
      leading={<IconButton icon="arrow-back" accessibilityLabel={t('flow.back')} onPress={() => router.back()} />}
      actions={<IconButton icon="close" accessibilityLabel={t('flow.close')} onPress={exit} />}
      footer={
        <Button
          testID="options-preview"
          label={t('options.preview')}
          icon="visibility"
          size="lg"
          fullWidth
          disabled={!form}
          onPress={() => {
            remember();
            router.push('/catalogue/preview');
          }}
        />
      }>
      {form ? (
        <OptionsForm form={form} update={update} />
      ) : (
        <View style={{ gap: space.md }}>
          <Skeleton height={140} rounded="card" />
          <Skeleton height={56} rounded="md" />
          <Skeleton height={56} rounded="md" />
        </View>
      )}
    </Screen>
  );
}

function OptionsForm({ form, update }: { form: CatalogueForm; update: (p: Partial<CatalogueForm>) => void }) {
  const { t } = useTranslation('catalogue');
  const { space } = useTheme();
  const [now] = useState(() => Date.now());
  const till = ratesValidTill(form.validForDays, now);

  return (
    <>
      <View style={{ gap: space.sm }}>
        <SectionHeader title={t('options.styleTitle')} />
        <View style={[styles.row, { gap: space.md }]} accessibilityRole="radiogroup">
          <StyleTile style="bazaar" selected={form.style === 'bazaar'} columns={form.columns} onPress={() => update({ style: 'bazaar' })} />
          <StyleTile style="ivory" selected={form.style === 'ivory'} columns={form.columns} onPress={() => update({ style: 'ivory' })} />
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <SectionHeader title={t('options.perRowTitle')} />
        <ChipGroup<CatalogueColumns>
          accessibilityLabel={t('options.perRowTitle')}
          mode="single"
          value={form.columns}
          onChange={(columns) => update({ columns })}
          options={[
            { value: 2, label: t('options.perRow2'), icon: 'grid-view' },
            { value: 3, label: t('options.perRow3'), icon: 'apps' },
          ]}
        />
      </View>

      <View style={{ gap: space.xs }}>
        <SectionHeader title={t('options.showTitle')} />
        <ToggleRow label={t('options.showRates')} value={form.showRates} onChange={(showRates) => update({ showRates })} testID="opt-rates" />
        <ToggleRow label={t('options.showOnlyLeft')} value={form.showOnlyLeft} onChange={(showOnlyLeft) => update({ showOnlyLeft })} />
        <ToggleRow label={t('options.showExactCounts')} value={form.showExactCounts} onChange={(showExactCounts) => update({ showExactCounts })} />
        <ToggleRow label={t('options.hideSoldOut')} value={form.hideSoldOut} onChange={(hideSoldOut) => update({ hideSoldOut })} />
      </View>

      <View style={{ gap: space.md }}>
        <SectionHeader title={t('options.wordsTitle')} />
        <TextField
          label={t('options.titleLabel')}
          helper={t('options.titleHelper')}
          value={form.title}
          onChangeText={(title) => update({ title })}
          maxLength={60}
          autoCapitalize="words"
          returnKeyType="done"
        />
        <View style={[styles.wrap, { gap: space.sm }]} accessibilityLabel={t('options.titleIdeas')}>
          {TITLE_IDEAS.map((k) => {
            const idea = t(`options.titleIdea.${k}`);
            return <Chip key={k} label={idea} selected={form.title === idea} onPress={() => update({ title: idea })} />;
          })}
        </View>
        <TextField
          label={t('options.noteLabel')}
          helper={t('options.noteHelper')}
          value={form.personalNote}
          onChangeText={(personalNote) => update({ personalNote })}
          maxLength={140}
          multiline
        />
        <View style={{ gap: space.sm }}>
          <AppText weight="semibold">{t('options.validTitle')}</AppText>
          <ChipGroup<ValidForDays>
            accessibilityLabel={t('options.validTitle')}
            mode="single"
            value={form.validForDays}
            onChange={(validForDays) => update({ validForDays })}
            options={VALID_FOR_CHOICES.map((d) => ({
              value: d,
              label: d === 0 ? t('options.validNone') : t('options.validDays', { count: d }),
              disabled: !form.showRates && d !== 0,
            }))}
          />
          <AppText variant="small" muted>
            {!form.showRates ? t('options.validNeedsRates') : till ? t('options.validDate', { date: formatDate(till) }) : ' '}
          </AppText>
        </View>
        <TextField
          label={t('options.discountLabel')}
          helper={t('options.discountHelper')}
          value={form.discountLine}
          onChangeText={(discountLine) => update({ discountLine })}
          maxLength={80}
        />
      </View>
    </>
  );
}

function ToggleRow({ label, value, onChange, testID }: { label: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  const { space } = useTheme();
  return (
    <PressableScale
      testID={testID}
      scaleTo={1}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={[styles.toggle, { gap: space.md, minHeight: touchTarget + 8 }]}>
      <AppText style={styles.flex}>{label}</AppText>
      <View importantForAccessibility="no-hide-descendants" pointerEvents="none">
        <Host matchContents>
          <Switch value={value} onValueChange={onChange} />
        </Host>
      </View>
    </PressableScale>
  );
}

/**
 * A tiny page in each PDF style: the seller chooses by looking, not by reading.
 * The colours are the PDF's own palettes (src/pdf/styles), not the app theme.
 */
function StyleTile({ style, selected, columns, onPress }: { style: CatalogueStyle; selected: boolean; columns: CatalogueColumns; onPress: () => void }) {
  const { t } = useTranslation('catalogue');
  const { colors, space, radius } = useTheme();
  const bazaar = style === 'bazaar';
  const paper = bazaar ? palette.ivory : palette.white;
  const frame = bazaar ? palette.chinar : palette.sand;
  const ink = bazaar ? [palette.chinar, palette.saffron, palette.teal, palette.rose, palette.indigo, palette.saffron] : [palette.sand, palette.sand, palette.sand, palette.sand, palette.sand, palette.sand];
  const cells = columns === 3 ? 6 : 4;
  return (
    <PressableScale
      testID={`style-${style}`}
      onPress={onPress}
      haptic="selection"
      accessibilityRole="radio"
      accessibilityLabel={`${t(`options.${style}`)}. ${t(`options.${style}Hint`)}`}
      accessibilityState={{ checked: selected }}
      style={styles.flex}>
      <View
        style={[
          styles.tile,
          { borderRadius: radius.card, padding: space.md, gap: space.sm, borderColor: selected ? colors.primary : colors.border, backgroundColor: colors.surface },
        ]}>
        <View style={[styles.page, { backgroundColor: paper, borderColor: frame, borderWidth: bazaar ? 4 : 1 }]}>
          <View style={[styles.pageTitle, { backgroundColor: bazaar ? palette.walnut : palette.walnutMuted, width: bazaar ? '70%' : '50%' }]} />
          <View style={[styles.grid, { gap: 4 }]}>
            {Array.from({ length: cells }, (_, i) => (
              <View key={i} style={[styles.cell, { width: columns === 3 ? '30%' : '46%', backgroundColor: ink[i] }]} />
            ))}
          </View>
        </View>
        <View>
          <AppText weight="semibold">{t(`options.${style}`)}</AppText>
          <AppText variant="small" muted numberOfLines={1}>
            {t(`options.${style}Hint`)}
          </AppText>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  toggle: { flexDirection: 'row', alignItems: 'center' },
  tile: { borderWidth: 2 },
  page: { aspectRatio: 0.72, padding: 8, gap: 8, borderRadius: 4 },
  pageTitle: { height: 6, borderRadius: 3, alignSelf: 'center' },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'flex-start' },
  cell: { aspectRatio: 0.9, borderRadius: 2 },
});
