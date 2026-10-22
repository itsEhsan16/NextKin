import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { Fragment } from 'react';
import { View } from 'react-native';

import type { TailorImprovement } from '@/data/models';
import { ProfileCard } from '@/features/profile/components/cards';
import { a11yHeader, pluralize } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type TailorImproveCardProps = { improvements: readonly TailorImprovement[] };

// "What to improve" at 390 (TAILOR 02 607:96 / 607:100), in artboard units.
const HEADING_TO_CARD = 12 / 0.75;
const ROW_PAD_X = 15 / 0.75;
const ROW_PAD_Y = 12 / 0.75;
const ROW_GAP = 12 / 0.75;
const SLOT_W = 18 / 0.75;
const SLOT_H = 20 / 0.75;
const GLYPH = 16 / 0.75;
const TEXT_GAP = 2 / 0.75;
const RULE = 1 / 0.75;

/**
 * "What to improve" (TAILOR 02): the count of fixes, then one card of rows — an amber "!" for a
 * fix, a green tick for a part that is already fine. Pressing Fix rewrites the fix rows without
 * asking (toreview §56.2); only new keywords wait for the user's yes.
 */
export function TailorImproveCard({ improvements }: TailorImproveCardProps) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  const fixes = improvements.filter((row) => !row.ok).length;

  return (
    <View>
      <View style={styles.heading}>
        <Text {...a11yHeader()} variant="title" style={styles.fill}>
          What to improve
        </Text>
        <Text variant="micro" color="textSecondary">
          {pluralize(fixes, 'fix', 'fixes')}
        </Text>
      </View>

      <ProfileCard style={styles.card}>
        {improvements.map((row, index) => (
          <Fragment key={row.key}>
            {index > 0 ? <View style={[styles.rule, { backgroundColor: colors.divider }]} /> : null}
            <View
              accessible
              accessibilityLabel={`${row.label}, ${row.ok ? 'fine' : 'to fix'}. ${row.detail}`}
              style={styles.row}
            >
              <View style={styles.slot}>
                <FontAwesome5
                  name={row.ok ? 'check-circle' : 'exclamation-circle'}
                  size={s(GLYPH)}
                  color={row.ok ? colors.glyphSuccess : colors.warningAccent}
                  solid
                />
              </View>
              <View style={styles.text}>
                <Text variant="menuRow">{row.label}</Text>
                <Text variant="micro" color="textSecondary">
                  {row.detail}
                </Text>
              </View>
            </View>
          </Fragment>
        ))}
      </ProfileCard>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  heading: { flexDirection: 'row', alignItems: 'center', gap: s(8 / 0.75) },
  fill: { flex: 1 },
  card: { marginTop: s(HEADING_TO_CARD) },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(ROW_GAP),
    paddingHorizontal: s(ROW_PAD_X),
    paddingVertical: s(ROW_PAD_Y),
  },
  slot: { width: s(SLOT_W), height: s(SLOT_H), alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: s(TEXT_GAP) },
  // Inset to the text column, as the board draws it (607:107: x 45, to 15 from the right).
  rule: {
    height: s(RULE),
    marginLeft: s(ROW_PAD_X + SLOT_W + ROW_GAP),
    marginRight: s(ROW_PAD_X),
  },
}));
