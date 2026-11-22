import { thumbUri } from '@/lib/photos';
import { Thumbnail } from '@/ui/components';
import { PatternPlaceholder } from '@/ui/patterns';
import { useTheme } from '@/ui/theme';

type Props = {
  productId: string;
  name: string;
  coverThumb: string | null;
  size: number;
  rounded?: 'sm' | 'md' | 'card';
};

/** Photo thumbnail, or the product's pattern art when it has no photo. Decorative (labelled by its row). */
export function ProductThumb({ productId, name, coverThumb, size, rounded = 'md' }: Props) {
  const { radius } = useTheme();
  if (!coverThumb) return <PatternPlaceholder productId={productId} name={name} width={size} height={size} radius={radius[rounded]} />;
  return <Thumbnail uri={thumbUri(coverThumb)} size={size} rounded={rounded} recyclingKey={productId} />;
}
