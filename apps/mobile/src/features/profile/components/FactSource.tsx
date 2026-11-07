import { View } from 'react-native';

import type { FactProvenance } from '@/data/models';
import { a11yButton, hitSlop8 } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pill, type PillTone } from '@/ui/Pill';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

const SOURCE: Record<Exclude<FactProvenance, 'user'>, { label: string; tone: PillTone }> = {
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
 * one tap to make it yours. Spec-derived from the app's status pill and a text link. Only what needs
 * a look shows (owner, toreview §148.1): a fact that is already yours draws nothing.
 */
export function FactSource({ provenance, what, label, onConfirm }: FactSourceProps) {
  const { spacing } = useTheme();
  const styles = useStyles();
  if (provenance === 'user') return null;
  const source = SOURCE[provenance];

  return (
    <View style={[styles.row, { gap: spacing[3] }]}>
      <Pill label={label ?? source.label} tone={source.tone} />
      <Pressable
        {...a11yButton(`Confirm ${what}`, 'Marks this as true, in your own word')}
        feedback="subtle"
        hitSlop={hitSlop8}
        onPress={onConfirm}
      >
        <Text variant="captionSemiBold" color="link">
          Confirm
        </Text>
      </Pressable>
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  row: { flexDirection: 'row', alignItems: 'center' },
}));
