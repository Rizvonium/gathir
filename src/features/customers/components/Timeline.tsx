import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatDate, formatDay } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { thumbUri } from '@/lib/photos';
import { AppSheet, AppText, Button, Icon, SectionHeader, TextField, Thumbnail } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { TIMELINE_PAGE, type TimelineRow } from '../logic/timeline';

const THUMB = 44;
const MAX_THUMBS = 3;

export type TimelineProps = {
  rows: TimelineRow[];
  productNames: Record<string, string>;
  onOpenSale: (saleId: string) => void;
  onOpenProduct: (productId: string) => void;
  onAddNote: () => void;
};

/** Newest-first history: purchases with photo thumbs, returns, catalogues/cards, notes, follow-ups. */
export function Timeline({ rows, productNames, onOpenSale, onOpenProduct, onAddNote }: TimelineProps) {
  const { space, colors } = useTheme();
  const { t } = useTranslation('customers');
  const [shown, setShown] = useState(TIMELINE_PAGE);

  return (
    <View style={{ gap: space.xs }}>
      <SectionHeader title={t('timeline.title')} actionLabel={t('timeline.addNote')} onAction={onAddNote} />
      {rows.length === 0 ? <AppText muted>{t('timeline.empty')}</AppText> : null}
      {rows.slice(0, shown).map((r, i) => (
        <View key={r.id} style={[styles.item, { gap: space.md }]}>
          <View style={styles.rail}>
            <View style={[styles.dot, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
              <Icon name={r.icon} size={18} tone={r.type === 'return' ? 'danger' : 'primary'} />
            </View>
            {i < Math.min(shown, rows.length) - 1 ? <View style={[styles.line, { backgroundColor: colors.border }]} /> : null}
          </View>
          <View style={[styles.body, { paddingBottom: space.lg }]}>
            <TimelineBody row={r} productNames={productNames} onOpenSale={onOpenSale} onOpenProduct={onOpenProduct} />
          </View>
        </View>
      ))}
      {rows.length > shown ? <Button label={t('timeline.showMore')} variant="ghost" icon="expand-more" onPress={() => setShown((n) => n + TIMELINE_PAGE)} /> : null}
    </View>
  );
}

function TimelineBody({ row: r, productNames, onOpenSale, onOpenProduct }: { row: TimelineRow } & Pick<TimelineProps, 'productNames' | 'onOpenSale' | 'onOpenProduct'>) {
  const { space, colors } = useTheme();
  const { t } = useTranslation('customers');
  const when = <AppText variant="caption" muted>{formatDate(r.at)}</AppText>;

  if (r.type === 'sale') {
    const title = r.cancelled ? t('timeline.saleCancelled') : t('timeline.sale', { count: r.pieces });
    const thumbs = r.items.slice(0, MAX_THUMBS);
    const extra = r.items.length - thumbs.length;
    return (
      <Pressable
        testID={`timeline-sale-${r.saleId}`}
        onPress={() => onOpenSale(r.saleId)}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${formatINR(r.totalPaise)}, ${formatDate(r.at)}. ${t('timeline.openSale', { bill: r.billNo })}`}
        style={({ pressed }) => [{ gap: space.xs, minHeight: 48 }, pressed && { backgroundColor: colors.surfaceSunken }]}>
        <View style={[styles.head, { gap: space.sm }]}>
          <AppText weight="semibold" style={styles.flex} numberOfLines={1}>
            {title}
          </AppText>
          <AppText weight="semibold" numeric style={r.cancelled ? styles.struck : undefined}>
            {formatINR(r.totalPaise)}
          </AppText>
        </View>
        <View style={[styles.head, { gap: space.sm }]}>
          {thumbs.map((it, idx) => (
            <Thumbnail key={idx} uri={it.photoName ? thumbUri(it.photoName) : null} size={THUMB} rounded="sm" />
          ))}
          {extra > 0 ? (
            <AppText variant="small" muted>
              {t('timeline.moreItems', { count: extra })}
            </AppText>
          ) : null}
          <AppText variant="small" muted numberOfLines={2} style={styles.flex}>
            {r.items.map((it) => `${it.productName} · ${it.colourName}`).join(', ')}
          </AppText>
        </View>
        <View style={[styles.head, { gap: space.sm }]}>
          {when}
          <AppText variant="caption" muted>
            {r.billNo}
          </AppText>
        </View>
      </Pressable>
    );
  }

  if (r.type === 'return') {
    return (
      <Pressable onPress={() => onOpenSale(r.saleId)} accessibilityRole="button" style={{ minHeight: 48, gap: space.xxs }}>
        <View style={[styles.head, { gap: space.sm }]}>
          <AppText weight="semibold" tone="danger" style={styles.flex}>
            {t('timeline.returned', { bill: r.billNo })}
          </AppText>
          <AppText numeric tone="danger">
            −{formatINR(r.totalPaise)}
          </AppText>
        </View>
        {when}
      </Pressable>
    );
  }

  const product = r.productId ? productNames[r.productId] : undefined;
  const title =
    r.kind === 'follow_up' && !r.done && r.dueAt !== null ? t(r.titleKey, { date: formatDay(r.dueAt) }) : t(r.titleKey, { count: r.count ?? 0 });
  const content = (
    <View style={{ gap: space.xxs }}>
      <AppText weight="semibold">{title}</AppText>
      {product ? <AppText variant="small">{product}</AppText> : null}
      {r.note ? <AppText>{r.note}</AppText> : null}
      {when}
    </View>
  );
  if (r.productId && product) {
    return (
      <Pressable onPress={() => onOpenProduct(r.productId as string)} accessibilityRole="button" style={{ minHeight: 48 }}>
        {content}
      </Pressable>
    );
  }
  return <View accessible>{content}</View>;
}

/** "Add note" sheet: one field, saved with Undo. */
export function NoteSheet({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (text: string) => boolean }) {
  const { t } = useTranslation('customers');
  const [text, setText] = useState('');
  const save = () => {
    if (onSave(text)) {
      setText('');
      onClose();
    }
  };
  return (
    <AppSheet visible={visible} onClose={onClose} title={t('timeline.noteTitle')} testID="note-sheet">
      <TextField
        testID="note-input"
        label={t('timeline.noteLabel')}
        placeholder={t('timeline.notePlaceholder')}
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
        autoCapitalize="sentences"
      />
      <Button testID="note-save" label={t('timeline.noteSave')} icon="check" size="lg" fullWidth disabled={!text.trim()} onPress={save} />
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row' },
  rail: { alignItems: 'center', width: 32 },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  line: { width: 2, flex: 1, marginTop: 2 },
  body: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 0 },
  struck: { textDecorationLine: 'line-through' },
});
