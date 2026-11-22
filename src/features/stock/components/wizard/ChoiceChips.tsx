import { View } from 'react-native';

import { AppText, Chip } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export type ChoiceChipsProps = {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  /** Called with '' when the selected chip is tapped again (choice cleared). */
  onChange: (value: string) => void;
  testID?: string;
};

/** Labelled single-choice chips that can be cleared by tapping the selected one again. */
export function ChoiceChips({ label, options, value, onChange, testID }: ChoiceChipsProps) {
  const { space } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="small" weight="semibold" muted>
        {label}
      </AppText>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {options.map((o) => (
          <Chip
            key={o.value}
            testID={testID ? `${testID}-${o.value}` : undefined}
            label={o.label}
            role="radio"
            selected={value === o.value}
            onPress={() => onChange(value === o.value ? '' : o.value)}
          />
        ))}
      </View>
    </View>
  );
}
