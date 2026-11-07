import { View } from 'react-native';

import { SUPPORT_REPLY_WINDOW } from '@/data/models';
import { Art, ProfileCard } from '@/features/profile/components/cards';
import { PROFILE_ROW_ART } from '@/features/profile/profileRowArt';
import { a11yButton, a11yHeader, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';

export type StillStuckCardProps = {
  /** The button's label — also its accessible name, so a test or a reader finds one control. */
  label: string;
  onPress: () => void;
};

// "Still stuck?" at 390 (SUPPORT 01 577:6271), in artboard units.
const GAP = 12 / 0.75;
const ICON_SLOT_W = 36 / 0.75;
const ICON_SLOT_H = 30 / 0.75;
/** The Contact us drawing, 34 wide on the board — passed as SectionCard passes its art. */
const ART_W = 34;
const TEXT_GAP = 2 / 0.75;
const BUTTON_H = 36 / 0.75;
const BUTTON_PAD_X = 12 / 0.75;
const BUTTON_GAP = 5 / 0.75;

/**
 * The way through to a person under the FAQ (577:6271): the Contact us drawing, the reply window,
 * and a compact ink pill that opens the message form.
 */
export function StillStuckCard({ label, onPress }: StillStuckCardProps) {
  const { colors, radii, spacing, s } = useTheme();
  const styles = useStyles();

  return (
    <ProfileCard style={[styles.card, { padding: spacing[5] }]}>
      <View style={styles.iconSlot}>
        <Art art={PROFILE_ROW_ART.contact} width={ART_W} />
      </View>
      <View style={styles.text}>
        <Text {...a11yHeader()} variant="title">
          Still stuck?
        </Text>
        <Text variant="micro" color="textSecondary">
          {SUPPORT_REPLY_WINDOW}
        </Text>
      </View>
      <Pressable
        {...a11yButton(label)}
        feedback="scale"
        hitSlop={hitSlopFor(s(BUTTON_H))}
        onPress={onPress}
        style={[
          styles.button,
          { borderRadius: radii.full, backgroundColor: colors.surfaceInverse },
        ]}
      >
        <Icon name="Mail01" size="xs" color={colors.textOnDark} />
        <Text variant="microBadge" color="textOnDark">
          {label}
        </Text>
      </Pressable>
    </ProfileCard>
  );
}

const useStyles = scaledSheet((s) => ({
  card: { flexDirection: 'row', alignItems: 'center', gap: s(GAP) },
  iconSlot: {
    width: s(ICON_SLOT_W),
    height: s(ICON_SLOT_H),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: s(TEXT_GAP) },
  button: {
    height: s(BUTTON_H),
    paddingHorizontal: s(BUTTON_PAD_X),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(BUTTON_GAP),
  },
}));
