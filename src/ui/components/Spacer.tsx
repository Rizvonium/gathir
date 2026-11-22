import { View } from 'react-native';

import { useTheme } from '../theme';
import type { space } from '../tokens';

export type SpacerProps = {
  /** Fixed gap from the spacing scale. Omit to flex-fill remaining space. */
  size?: keyof typeof space;
  /** Direction of the fixed gap. Default vertical. */
  horizontal?: boolean;
};

/** Empty space on the 4-pt grid, or a flexible filler when no size is given. Prefer `gap`. */
export function Spacer({ size, horizontal = false }: SpacerProps) {
  const { space: s } = useTheme();
  if (!size) return <View style={{ flex: 1 }} importantForAccessibility="no" />;
  return <View importantForAccessibility="no" style={horizontal ? { width: s[size] } : { height: s[size] }} />;
}
