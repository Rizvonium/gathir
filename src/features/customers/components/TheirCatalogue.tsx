/**
 * "Their catalogue" (PLAN §4.8): the customer's personal shortlist with special rates, availability
 * and notes. Tap a piece to edit its rate and note; "Arrange" shows move up/down and remove buttons
 * (buttons, not drag, so it works with TalkBack and big fonts). Removing is undoable from a toast.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CatalogueVersion, CustomerCatalogueRow } from '@/db/repo/customerCatalogue';
import { formatDate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { ProductThumb } from '@/features/catalogue/components/ProductThumb';
import { AppSheet, AppText, Button, Card, Divider, Icon, IconButton, MoneyInput, PieceBadge, SectionHeader, TextField } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import {
  itemAvailability,
  specialRateOffPct,
  specialRateToSave,
  theirCatalogueCounts,
  versionCounts,
} from '../logic/theirCatalogue';

/** Versions shown before "Show all". */
const VERSIONS_SHOWN = 3;
const THUMB = 64;

export type TheirCatalogueProps = {
  customerName: string;
  rows: CustomerCatalogueRow[];
  versions: CatalogueVersion[];
  lowStockLevel: number;
  onAdd: () => void;
  onSend: () => void;
  onRemove: (row: CustomerCatalogueRow) => void;
  onMove: (row: CustomerCatalogueRow, dir: -1 | 1) => void;
  onSave: (row: CustomerCatalogueRow, patch: { specialRatePaise: number | null; note: string }) => boolean;
  onOpenProduct: (productId: string) => void;
};

export function TheirCatalogue({ customerName, rows, versions, lowStockLevel, onAdd, onSend, onRemove, onMove, onSave, onOpenProduct }: TheirCatalogueProps) {
  const { t } = useTranslation('customers');
  const { space } = useTheme();
  const [arranging, setArranging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const counts = theirCatalogueCounts(rows);
  const editing = rows.find((r) => r.id === editingId) ?? null;
  const version = versions.find((v) => v.eventId === versionId) ?? null;
  const isArranging = arranging && rows.length > 0;

  return (
    <View style={{ gap: space.sm }} testID="their-catalogue">
      <SectionHeader
        title={t('theirCatalogue.title')}
        actionLabel={rows.length > 1 || isArranging ? (isArranging ? t('theirCatalogue.doneArranging') : t('theirCatalogue.arrange')) : undefined}
        onAction={() => setArranging((a) => !a)}
      />
      {rows.length === 0 ? (
        <AppText muted>{t('theirCatalogue.empty', { name: customerName })}</AppText>
      ) : (
        <Card padding="none">
          {rows.map((row, i) => (
            <View key={row.id}>
              {i > 0 ? <Divider inset={THUMB + space.lg + space.md} /> : null}
              <ItemRow
                row={row}
                lowStockLevel={lowStockLevel}
                arranging={isArranging}
                first={i === 0}
                last={i === rows.length - 1}
                onPress={() => setEditingId(row.id)}
                onMove={(dir) => onMove(row, dir)}
                onRemove={() => onRemove(row)}
              />
            </View>
          ))}
        </Card>
      )}

      <Button testID="their-catalogue-add" label={t('theirCatalogue.add')} icon="add" variant="tonal" onPress={onAdd} />
      {rows.length > 0 ? (
        <View style={{ gap: space.xs }}>
          <Button
            testID="their-catalogue-send"
            label={t('theirCatalogue.send', { count: counts.sendable > 0 ? counts.sendable : counts.sendableWithSoldOut })}
            icon="picture-as-pdf"
            disabled={counts.sendableWithSoldOut === 0}
            onPress={onSend}
          />
          {counts.soldOut > 0 ? (
            <View style={[styles.row, { gap: space.xs }]}>
              <Icon name="info-outline" size={18} tone="textMuted" />
              <AppText variant="small" muted style={styles.flex}>
                {t('theirCatalogue.soldOutNote', { count: counts.soldOut })}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}

      {versions.length > 0 ? <Versions versions={versions} onOpen={setVersionId} /> : null}

      <ItemSheet
        row={editing}
        onClose={() => setEditingId(null)}
        onSave={(patch) => {
          if (editing && onSave(editing, patch)) setEditingId(null);
        }}
        onRemove={() => {
          if (!editing) return;
          setEditingId(null);
          onRemove(editing);
        }}
        onOpenProduct={() => {
          if (!editing) return;
          setEditingId(null);
          onOpenProduct(editing.productId);
        }}
      />
      <VersionSheet version={version} onClose={() => setVersionId(null)} />
    </View>
  );
}

function ItemRow({
  row,
  lowStockLevel,
  arranging,
  first,
  last,
  onPress,
  onMove,
  onRemove,
}: {
  row: CustomerCatalogueRow;
  lowStockLevel: number;
  arranging: boolean;
  first: boolean;
  last: boolean;
  onPress: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('customers');
  const { colors, space } = useTheme();
  const availability = itemAvailability(row);
  const off = specialRateOffPct(row.normalRatePaise, row.specialRatePaise);
  const special = row.specialRatePaise !== null;
  const label = [
    row.name,
    special
      ? t('theirCatalogue.rateSpecialA11y', { rate: formatINR(row.ratePaise), normal: formatINR(row.normalRatePaise) })
      : formatINR(row.ratePaise),
    t(`theirCatalogue.availability.${availability}`),
    row.note,
  ]
    .filter(Boolean)
    .join('. ');

  const body = (
    <>
      <View style={availability === 'out' || availability === 'deleted' ? styles.dim : undefined}>
        <ProductThumb productId={row.productId} name={row.name} coverThumb={row.coverThumb} size={THUMB} />
      </View>
      <View style={[styles.flex, { gap: 2 }]}>
        <AppText weight="semibold" numberOfLines={2}>
          {row.name}
        </AppText>
        <View style={[styles.row, styles.wrap, { gap: space.sm }]}>
          {special ? (
            <>
              <AppText variant="small" muted numeric style={styles.struck} testID={`their-item-normal-${row.id}`}>
                {formatINR(row.normalRatePaise)}
              </AppText>
              <AppText weight="bold" numeric tone="primary">
                {formatINR(row.ratePaise)}
              </AppText>
              {off !== null && off > 0 ? (
                <AppText variant="caption" muted numeric>
                  {t('theirCatalogue.off', { pct: off })}
                </AppText>
              ) : null}
            </>
          ) : (
            <AppText numeric>{formatINR(row.ratePaise)}</AppText>
          )}
        </View>
        {availability === 'deleted' ? (
          <View style={[styles.row, { gap: space.xs }]}>
            <Icon name="delete-outline" size={16} tone="danger" />
            <AppText variant="caption" tone="danger">
              {t('theirCatalogue.availability.deleted')}
            </AppText>
          </View>
        ) : (
          <PieceBadge count={row.totalPieces} lowThreshold={lowStockLevel} size="sm" style={styles.badge} />
        )}
        {row.note ? (
          <AppText variant="small" muted numberOfLines={2}>
            {row.note}
          </AppText>
        ) : null}
      </View>
    </>
  );

  if (arranging) {
    return (
      <View style={[styles.row, { padding: space.md, gap: space.md }]} accessible={false}>
        <View style={[styles.row, styles.flex, { gap: space.md }]} accessible accessibilityLabel={label}>
          {body}
        </View>
        <View style={styles.arrange}>
          <IconButton icon="arrow-upward" size={48} accessibilityLabel={t('theirCatalogue.moveUp', { name: row.name })} disabled={first} onPress={() => onMove(-1)} testID={`their-item-up-${row.id}`} />
          <IconButton icon="arrow-downward" size={48} accessibilityLabel={t('theirCatalogue.moveDown', { name: row.name })} disabled={last} onPress={() => onMove(1)} testID={`their-item-down-${row.id}`} />
        </View>
        <IconButton icon="remove-circle-outline" color={colors.danger} accessibilityLabel={t('theirCatalogue.removeLabel', { name: row.name })} onPress={onRemove} testID={`their-item-remove-${row.id}`} />
      </View>
    );
  }

  return (
    <Pressable
      testID={`their-item-${row.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('theirCatalogue.editHint')}
      style={({ pressed }) => [styles.row, { padding: space.md, gap: space.md }, pressed && { backgroundColor: colors.surfaceSunken }]}>
      {body}
      <Icon name="edit" size={20} tone="textMuted" />
    </Pressable>
  );
}

/** Edit one piece: special rate for this customer (empty = normal rate) and a note. */
function ItemSheet({
  row,
  onClose,
  onSave,
  onRemove,
  onOpenProduct,
}: {
  row: CustomerCatalogueRow | null;
  onClose: () => void;
  onSave: (patch: { specialRatePaise: number | null; note: string }) => void;
  onRemove: () => void;
  onOpenProduct: () => void;
}) {
  const { t } = useTranslation('customers');
  const { space } = useTheme();
  const [forId, setForId] = useState<string | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [note, setNote] = useState('');

  // Load the row's values each time the sheet opens on a different piece.
  if (row && row.id !== forId) {
    setForId(row.id);
    setRate(row.specialRatePaise);
    setNote(row.note);
  }
  // Closed: forget unsaved edits so reopening the same piece starts from its saved values.
  if (!row && forId !== null) setForId(null);

  const off = row ? specialRateOffPct(row.normalRatePaise, specialRateToSave(row.normalRatePaise, rate)) : null;
  const helper =
    off === null ? t('theirCatalogue.sheet.rateHelper') : off >= 0 ? t('theirCatalogue.sheet.rateOff', { pct: off }) : t('theirCatalogue.sheet.rateAbove', { pct: -off });

  return (
    <AppSheet visible={!!row} onClose={onClose} title={row?.name} testID="their-item-sheet">
      {row ? (
        <View style={{ gap: space.md }}>
          <AppText muted numeric>
            {t('theirCatalogue.sheet.normalRate', { rate: formatINR(row.normalRatePaise) })}
          </AppText>
          <MoneyInput testID="their-item-rate" label={t('theirCatalogue.sheet.rateLabel')} value={rate} onChange={setRate} helper={helper} placeholder={formatINR(row.normalRatePaise).replace('₹', '')} />
          <TextField
            testID="their-item-note"
            label={t('theirCatalogue.sheet.noteLabel')}
            placeholder={t('theirCatalogue.sheet.notePlaceholder')}
            value={note}
            onChangeText={setNote}
            maxLength={140}
            multiline
          />
          <Button
            testID="their-item-save"
            label={t('theirCatalogue.sheet.save')}
            icon="check"
            size="lg"
            fullWidth
            onPress={() => onSave({ specialRatePaise: specialRateToSave(row.normalRatePaise, rate), note: note.trim() })}
          />
          <View style={[styles.row, { gap: space.sm }]}>
            <Button label={t('theirCatalogue.sheet.openDesign')} icon="open-in-new" variant="ghost" onPress={onOpenProduct} />
            <View style={styles.flex} />
            <Button testID="their-item-sheet-remove" label={t('theirCatalogue.sheet.remove')} icon="remove-circle-outline" variant="ghost" onPress={onRemove} />
          </View>
        </View>
      ) : null}
    </AppSheet>
  );
}

function Versions({ versions, onOpen }: { versions: CatalogueVersion[]; onOpen: (eventId: string) => void }) {
  const { t } = useTranslation('customers');
  const { space } = useTheme();
  const [all, setAll] = useState(false);
  const shown = all ? versions : versions.slice(0, VERSIONS_SHOWN);
  return (
    <View style={{ gap: space.xs, marginTop: space.sm }}>
      <AppText weight="semibold">{t('theirCatalogue.versions.title')}</AppText>
      {shown.map((v) => {
        const c = versionCounts(v);
        const parts = [t('theirCatalogue.versions.items', { count: c.items })];
        if (c.special > 0) parts.push(t('theirCatalogue.versions.special', { count: c.special }));
        const title = v.title || (v.personal ? t('theirCatalogue.versions.personal') : t('theirCatalogue.versions.general'));
        return (
          <Pressable
            key={v.eventId}
            testID={`their-version-${v.eventId}`}
            onPress={() => onOpen(v.eventId)}
            accessibilityRole="button"
            accessibilityLabel={`${formatDate(v.sentAt)}. ${title}. ${parts.join(', ')}`}
            style={[styles.row, { minHeight: 48, gap: space.md }]}>
            <Icon name={v.personal ? 'favorite' : 'picture-as-pdf'} size={20} tone="textMuted" />
            <View style={styles.flex}>
              <AppText numberOfLines={1}>
                {formatDate(v.sentAt)} · {title}
              </AppText>
              <AppText variant="small" muted>
                {parts.join(' · ')}
              </AppText>
            </View>
            <Icon name="chevron-right" size={20} tone="textMuted" />
          </Pressable>
        );
      })}
      {versions.length > VERSIONS_SHOWN ? (
        <Button
          label={all ? t('theirCatalogue.versions.fewer') : t('theirCatalogue.versions.all', { count: versions.length })}
          variant="ghost"
          size="sm"
          onPress={() => setAll((a) => !a)}
        />
      ) : null}
    </View>
  );
}

/** What one sent catalogue offered, and at what rate (the logged snapshot). */
function VersionSheet({ version, onClose }: { version: CatalogueVersion | null; onClose: () => void }) {
  const { t } = useTranslation('customers');
  const { space } = useTheme();
  return (
    <AppSheet visible={!!version} onClose={onClose} title={version ? t('theirCatalogue.versions.sheetTitle', { date: formatDate(version.sentAt) }) : undefined} testID="their-version-sheet">
      {version ? (
        <View style={{ gap: space.sm }}>
          {version.title ? <AppText muted>{version.title}</AppText> : null}
          {version.items.length === 0 ? (
            <AppText muted>{t('theirCatalogue.versions.noRates', { count: version.productIds.length })}</AppText>
          ) : (
            version.items.map((item) => (
              <View key={item.productId} style={[styles.row, { gap: space.md, minHeight: 40 }]} accessible>
                <AppText style={styles.flex} numberOfLines={2}>
                  {item.name}
                </AppText>
                {item.specialPrice ? (
                  <AppText variant="caption" tone="primary" weight="semibold">
                    {t('theirCatalogue.versions.specialTag')}
                  </AppText>
                ) : null}
                <AppText numeric weight={item.specialPrice ? 'bold' : 'regular'}>
                  {item.ratePaise === null ? t('theirCatalogue.versions.noRate') : formatINR(item.ratePaise)}
                </AppText>
              </View>
            ))
          )}
        </View>
      ) : null}
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexWrap: 'wrap' },
  arrange: { flexDirection: 'column' },
  struck: { textDecorationLine: 'line-through' },
  dim: { opacity: 0.45 },
  badge: { alignSelf: 'flex-start' },
});
