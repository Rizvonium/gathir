import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Chip } from './Chip';
import type { IconName } from './Icon';

export type ChipOption<T extends string | number> = {
  value: T;
  label: string;
  icon?: IconName;
  /** Custom leading slot, e.g. a ColourSwatch. */
  leading?: ReactNode;
  disabled?: boolean;
};

type Common<T extends string | number> = {
  options: ChipOption<T>[];
  /** Group name for TalkBack, e.g. "Payment". */
  accessibilityLabel: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export type ChipGroupProps<T extends string | number> = Common<T> &
  (
    | { mode: 'single'; value: T | null; onChange: (value: T) => void }
    | { mode: 'multi'; value: T[]; onChange: (value: T[]) => void }
  );

/**
 * Wrapping row of chips. `mode="single"` behaves like radio buttons (tapping the selected chip
 * keeps it); `mode="multi"` toggles each value and keeps the options' order.
 */
export function ChipGroup<T extends string | number>(props: ChipGroupProps<T>) {
  const { space } = useTheme();
  const { options, accessibilityLabel, testID, style } = props;

  const isSelected = (v: T) => (props.mode === 'single' ? props.value === v : props.value.includes(v));

  const toggle = (v: T) => {
    if (props.mode === 'single') {
      if (props.value !== v) props.onChange(v);
      return;
    }
    const set = new Set(props.value);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    props.onChange(options.map((o) => o.value).filter((x) => set.has(x)));
  };

  return (
    <View
      testID={testID}
      accessibilityRole={props.mode === 'single' ? 'radiogroup' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[styles.wrap, { gap: space.sm }, style]}>
      {options.map((o) => (
        <Chip
          key={String(o.value)}
          testID={testID ? `${testID}-${String(o.value)}` : undefined}
          label={o.label}
          icon={o.icon}
          leading={o.leading}
          disabled={o.disabled}
          role={props.mode === 'single' ? 'radio' : 'checkbox'}
          selected={isSelected(o.value)}
          onPress={() => toggle(o.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
