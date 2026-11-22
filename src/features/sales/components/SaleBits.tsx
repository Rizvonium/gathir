/** Small shared pieces for sales screens: product thumb with pattern fallback, payment label. */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PaymentMethod } from '@/db/schema';
import { thumbUri } from '@/lib/photos';
import { AppText, Icon, Thumbnail } from '@/ui/components';
import { PatternPlaceholder } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

import { PAYMENT_ICONS } from '../logic/salesList';

export type ProductThumbProps = {
  productId: string;
  name: string;
  /** Thumbnail file name (repo rows hold names, not URIs) or null. */
  thumb: string | null;
  size?: number;
  rounded?: 'sm' | 'md' | 'card';
  recyclingKey?: string;
  accessibilityLabel?: string;
};

/** Photo thumbnail, or the product's generated pattern when it has no photo. */
export function ProductThumb({ productId, name, thumb, size = 56, rounded = 'md', recyclingKey, accessibilityLabel }: ProductThumbProps) {
  const { radius } = useTheme();
  if (!thumb) {
    return (
      <View style={{ width: size, height: size }} testID={`thumb-placeholder-${productId}`}>
        <PatternPlaceholder productId={productId} name={name} width={size} height={size} radius={radius[rounded]} accessibilityLabel={accessibilityLabel} />
      </View>
    );
  }
  return <Thumbnail uri={thumbUri(thumb)} size={size} rounded={rounded} recyclingKey={recyclingKey} accessibilityLabel={accessibilityLabel} />;
}

/** Icon + word ("UPI"): payment is never shown by icon alone. */
export function PaymentLabel({ payment, muted = true }: { payment: PaymentMethod; muted?: boolean }) {
  const { t } = useTranslation('sales');
  const { space } = useTheme();
  return (
    <View style={[styles.row, { gap: space.xs }]}>
      <Icon name={PAYMENT_ICONS[payment]} size={16} tone={muted ? 'textMuted' : 'text'} />
      <AppText variant="small" muted={muted}>
        {t(`payment.${payment}`)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
