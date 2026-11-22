import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatPhone } from '@/lib/phone';
import { formatINR } from '@/lib/money';
import { AppText, Avatar, Button, Card, EmptyState, Icon, IconButton, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme';

import { useContactActions } from '../hooks/useContactActions';
import { useCustomerProfileScreen } from '../hooks/useCustomerProfileScreen';
import { useNow } from '../hooks/useNow';
import { avatarTint, likesEmpty, relativePast } from '../logic/customerLogic';
import { addPiecesHref, catalogueHref, editCustomerHref, productHref, saleHref, sellToHref, theirCatalogueHref } from '../logic/links';
import { FollowUpList, FollowUpSheet } from './FollowUps';
import { LikesSection } from './LikesSection';
import { SuggestedStrip } from './SuggestedStrip';
import { TheirCatalogue } from './TheirCatalogue';
import { NoteSheet, Timeline } from './Timeline';

const back = () => (router.canGoBack() ? router.back() : router.replace('/customers'));

/** Customer profile (PLAN §4.8): contact, totals, likes, suggestions, follow-ups and history. */
export function CustomerProfileScreen({ id }: { id: string | undefined }) {
  const { colors, space, radius } = useTheme();
  const { t } = useTranslation('customers');
  const p = useCustomerProfileScreen(id);
  const contact = useContactActions();
  const now = useNow();
  const [followOpen, setFollowOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const backButton = <IconButton icon="arrow-back" accessibilityLabel={t('profile.back')} onPress={back} testID="customer-back" />;

  if (!p.profile) {
    return (
      <Screen leading={backButton}>
        <EmptyState title={t('profile.notFoundTitle')} body={t('profile.notFoundBody')} actionLabel={t('profile.back')} actionIcon="arrow-back" onAction={back} />
      </Screen>
    );
  }

  const { customer, stats, likes, learnedLikes, openFollowUps } = p.profile;
  const deleted = customer.deletedAt !== null;
  const accents = [colors.teal, colors.rose, colors.meadow, colors.indigo, colors.primary];
  const meta = [t(`tags.${customer.tag}`), customer.city].filter(Boolean).join(' · ');
  const lastVisit = stats.lastVisitAt !== null ? relativePast(stats.lastVisitAt, now) : null;
  const nothingToMatch = likesEmpty(likes) && learnedLikes.crafts.length === 0 && learnedLikes.colours.length === 0;
  const phone = customer.phone;

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      leading={backButton}
      actions={!deleted ? <IconButton icon="edit" accessibilityLabel={t('profile.edit')} onPress={() => router.push(editCustomerHref(customer.id))} testID="customer-edit" /> : undefined}
      footer={
        !deleted ? (
          <Button testID="customer-sell" label={t('profile.sell', { name: customer.name })} icon="sell" size="lg" fullWidth onPress={() => router.push(sellToHref(customer.id))} />
        ) : undefined
      }>
      {deleted ? (
        <View style={[styles.banner, { gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceSunken }]}>
          <Icon name="restore-from-trash" tone="danger" />
          <AppText style={styles.flex}>{t('profile.deletedBanner')}</AppText>
          <Button testID="customer-restore" label={t('profile.restore')} size="sm" variant="tonal" onPress={p.restore} />
        </View>
      ) : null}

      {/* Header */}
      <View style={[styles.header, { gap: space.lg }]}>
        <Avatar name={customer.name} color={avatarTint(customer.id, likes.colours[0] ?? null, accents)} size={72} />
        <View style={styles.flex}>
          <AppText variant="heading" accessibilityRole="header" numberOfLines={3}>
            {customer.name}
          </AppText>
          {meta ? <AppText muted>{meta}</AppText> : null}
          {phone ? (
            <AppText selectable numeric accessibilityLabel={`${t('profile.phoneCopy')}: ${formatPhone(phone)}`}>
              {formatPhone(phone)}
            </AppText>
          ) : (
            <AppText muted>{t('profile.noPhone')}</AppText>
          )}
        </View>
      </View>

      {phone ? (
        <View style={[styles.row, { gap: space.sm }]}>
          <Button testID="customer-whatsapp" label={t('profile.whatsapp')} icon="chat" size="lg" style={styles.flex} onPress={() => void contact.whatsapp(phone)} />
          <Button testID="customer-call" label={t('profile.call')} icon="call" size="lg" variant="secondary" style={styles.flex} onPress={() => void contact.call(phone)} />
        </View>
      ) : !deleted ? (
        <Button label={t('profile.addPhone')} icon="add-call" variant="tonal" onPress={() => router.push(editCustomerHref(customer.id))} />
      ) : null}
      {!customer.whatsappOk ? (
        <View style={[styles.row, { gap: space.xs }]}>
          <Icon name="block" size={18} tone="textMuted" />
          <AppText variant="small" muted>
            {t('profile.noCatalogues')}
          </AppText>
        </View>
      ) : null}

      {/* Stats */}
      <Card padding="md">
        <View style={[styles.row, { gap: space.md }]} accessible accessibilityLabel={[
          `${t('profile.stats.spent')}: ${formatINR(stats.lifetimeSpendPaise)}`,
          `${t('profile.stats.purchases')}: ${stats.purchases}`,
          `${t('profile.stats.lastVisit')}: ${lastVisit ? t(lastVisit.key, { count: lastVisit.count }) : t('profile.stats.never')}`,
        ].join('. ')}>
          <Stat label={t('profile.stats.spent')} value={formatINR(stats.lifetimeSpendPaise)} wide />
          <Stat label={t('profile.stats.purchases')} value={String(stats.purchases)} />
          <Stat label={t('profile.stats.lastVisit')} value={lastVisit ? t(lastVisit.key, { count: lastVisit.count }) : t('profile.stats.never')} small />
        </View>
        {stats.piecesBought > 0 ? (
          <AppText variant="small" muted style={{ marginTop: space.sm }}>
            {t('profile.stats.pieces', { count: stats.piecesBought })}
          </AppText>
        ) : null}
      </Card>

      {!deleted ? (
        <FollowUpList
          events={openFollowUps}
          now={now}
          canMessage={!!phone}
          onAdd={() => setFollowOpen(true)}
          onDone={(e) => void p.markDone(e)}
          onMessage={() => void contact.whatsapp(phone ?? null)}
        />
      ) : null}

      <LikesSection likes={likes} suggestion={deleted ? null : p.suggestion} onSave={p.saveLikes} onAccept={p.acceptLearned} onDismiss={p.dismissLearned} />

      {!deleted ? (
        <TheirCatalogue
          customerName={customer.name}
          rows={p.catalogueRows}
          versions={p.catalogueVersions}
          lowStockLevel={p.lowStockLevel}
          onAdd={() => router.push(addPiecesHref(customer.id))}
          onSend={() => router.push(theirCatalogueHref(customer.id))}
          onRemove={(row) => p.catalogue.remove(row.id, row.name)}
          onMove={(row, dir) =>
            p.catalogue.move(
              p.catalogueRows.map((r) => r.id),
              row.id,
              dir,
            )
          }
          onSave={(row, patch) => p.catalogue.save(row.id, patch, { specialRatePaise: row.specialRatePaise, note: row.note })}
          onOpenProduct={(pid) => router.push(productHref(pid))}
        />
      ) : null}

      {!deleted ? (
        <SuggestedStrip
          items={p.suggestions}
          nothingToMatch={nothingToMatch}
          onOpen={(pid) => router.push(productHref(pid))}
          onSend={(ids) => router.push(catalogueHref(customer.id, ids))}
          inCatalogue={p.inCatalogue}
          onAddToCatalogue={p.addSuggestedToCatalogue}
        />
      ) : null}

      {!deleted ? (
        <Button testID="customer-catalogue" label={t('profile.sendCatalogue')} icon="picture-as-pdf" variant="secondary" onPress={() => router.push(catalogueHref(customer.id))} />
      ) : null}

      <Timeline rows={p.rows} productNames={p.productNames} onOpenSale={(sid) => router.push(saleHref(sid))} onOpenProduct={(pid) => router.push(productHref(pid))} onAddNote={() => setNoteOpen(true)} />

      {customer.notes ? (
        <Card padding="md">
          <AppText variant="small" weight="semibold" muted>
            {t('form.notes')}
          </AppText>
          <AppText selectable>{customer.notes}</AppText>
        </Card>
      ) : null}

      {!deleted ? (
        <View style={{ gap: space.xs, marginTop: space.lg }}>
          <Button testID="customer-delete" label={t('profile.delete')} icon="delete-outline" variant="ghost" onPress={p.deleteCustomer} />
          <AppText variant="small" muted align="center">
            {t('profile.deleteHelp')}
          </AppText>
        </View>
      ) : null}

      <FollowUpSheet now={now} visible={followOpen} onClose={() => setFollowOpen(false)} onSave={(dueAt, note) => void p.setFollowUp(dueAt, note)} />
      <NoteSheet visible={noteOpen} onClose={() => setNoteOpen(false)} onSave={p.saveNote} />
    </Screen>
  );
}

function Stat({ label, value, wide, small }: { label: string; value: string; wide?: boolean; small?: boolean }) {
  return (
    <View style={[styles.stat, wide && styles.statWide]}>
      <AppText variant={small ? 'body' : 'title'} weight="bold" numeric numberOfLines={2} adjustsFontSizeToFit={!small}>
        {value}
      </AppText>
      <AppText variant="caption" muted>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  banner: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, minWidth: 0 },
  statWide: { flex: 1.4 },
});
