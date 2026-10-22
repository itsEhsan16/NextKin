import { View } from 'react-native';

import { board } from '../board';
import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type AuthDividerProps = {
  /** Half the band, which is what the row carries above and below its rule. */
  margin: number;
  /** Rule-to-word, drawn. Sign-up reuses its field gap for this; sign-in does not. */
  gap: number;
  hairline: number;
};

/** The "or" band both auth forms set between their primary button and Google (309:337). */
export function AuthDivider({ margin, gap, hairline }: AuthDividerProps) {
  const { colors, s } = useTheme();
  const styles = useStyles();

  const rule = { height: s(board(hairline)), backgroundColor: colors.authFieldBorder };

  return (
    <View style={[styles.row, { marginVertical: s(board(margin)), gap: s(board(gap)) }]}>
      <View style={[styles.rule, rule]} />
      <Text variant="authField" color="textTertiary">
        or
      </Text>
      <View style={[styles.rule, rule]} />
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  rule: { flex: 1 },
}));
