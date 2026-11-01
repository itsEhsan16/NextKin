import { View } from 'react-native';

import type { FactProvenance } from '@/data/models';
import { a11yButton, hitSlop8 } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pill, type PillTone } from '@/ui/Pill';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

const SOURCE: Record<FactProvenance, { label: string; tone: PillTone }> = {
  user: { label: 'Confirmed', tone: 'success' },
  parsed_confirmed: { label: 'From your resume', tone: 'neutral' },
  assumed: { label: 'Assumed', tone: 'warning' },
};

export type FactSourceProps = {
  provenance: FactProvenance;
  /** Names what a tap confirms, for a screen reader: "Confirm Designer". */
  what: string;
  /** Says it for a whole list: "12 from your resume". */
  label?: string;
  onConfirm: () => void;
};

/**
 * Where a fact on the profile came from (toreview §146.3): you, your resume, or an assumption, with
 * one tap to make it yours. Spec-derived from the app's status pill and a text link.
 */
export function FactSource({ provenance, what, label, onConfirm }: FactSourceProps) {
  const { spacing } = useTheme();
  const styles = useStyles();
  const source = SOURCE[provenance];

  return (
    <View style={[styles.row, { gap: spacing[3] }]}>
      <Pill label={label ?? source.label} tone={source.tone} />
      {provenance === 'user' ? null : (
        <Pressable
          {...a11yButton(`Confirm ${what}`, 'Marks this as true, in your own word')}
          feedback="subtle"
          haptic="light"
          hitSlop={hitSlop8}
          onPress={onConfirm}
        >
          <Text variant="captionSemiBold" color="link">
            Confirm
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  row: { flexDirection: 'row', alignItems: 'center' },
}));
