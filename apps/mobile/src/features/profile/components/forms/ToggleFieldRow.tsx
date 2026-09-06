import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';
import { Toggle } from '@/ui/Toggle';

/** ListRow's metrics, so a switch row lines up with the date rows above and below it. */
const PADDING_X = 20;
const GUTTER = 16;

export type ToggleFieldRowProps = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

/** A switch inside a `RowGroup` — "I currently work here", "I'm still studying here". */
export function ToggleFieldRow({ label, value, onChange }: ToggleFieldRowProps) {
  const { sizes, s } = useTheme();

  return (
    <View
      style={[
        styles.row,
        { minHeight: sizes.listRow, paddingHorizontal: s(PADDING_X), gap: s(GUTTER) },
      ]}
    >
      <Text variant="rowTitle" style={styles.label}>
        {label}
      </Text>
      <Toggle value={value} onChange={onChange} label={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1 },
});
