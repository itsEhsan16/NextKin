import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import type { ListRowArt } from '@/ui/ListRow';
import { Text } from '@/ui/Text';

/**
 * The card every redesigned profile editor is built from (PROFILE 03–16, Figma 577:5365): white,
 * an r18 corner at 390, a hairline border and the job cards' one-pixel shadow. Lengths below are
 * the 390 board's over 0.75, the artboard units `s()` projects from.
 */
export const CARD_RADIUS = 18 / 0.75;
/** Card → card down the page (577:5364). */
export const CARD_GAP = 14 / 0.75;

const HEADER_GAP = 10 / 0.75;
const ICON_SLOT_W = 34 / 0.75;
const ICON_SLOT_H = 28 / 0.75;
const TITLE_GAP = 1 / 0.75;

export function ProfileCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, sizes, shadows, s } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceCard,
          borderWidth: sizes.border,
          borderColor: colors.borderHairline,
          borderRadius: s(CARD_RADIUS),
        },
        shadows.jobCard,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** An illustrated profile icon drawn at `width`, its height kept to the export's own shape. */
export function Art({ art, width }: { art: ListRowArt; width: number }) {
  const { s } = useTheme();
  return <art.Icon width={s(width)} height={s((width * art.h) / art.w)} />;
}

export type SectionCardProps = {
  /** The card header's illustrated icon (577:5367); the field cards of the chip screens have none. */
  art?: ListRowArt;
  /** Width the icon is drawn at on 390 — the boards vary it by icon (30, 28, 26). */
  artWidth?: number;
  title: string;
  /** One quiet line under the title — "Month and year are enough" (573:216). */
  subtitle?: string;
  /** A count at the header's end — "3 skills" (573:237). */
  trailing?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** A titled group of fields (PROFILE 03 "About you", PROFILE 05 "Dates"). */
export function SectionCard({
  art,
  artWidth = 30,
  title,
  subtitle,
  trailing,
  children,
  style,
}: SectionCardProps) {
  const { spacing } = useTheme();
  const styles = useStyles();

  return (
    <ProfileCard style={[{ padding: spacing[5], gap: spacing[4] }, style]}>
      <View style={styles.header}>
        {art ? (
          <View style={styles.iconSlot}>
            <Art art={art} width={artWidth} />
          </View>
        ) : null}
        <View style={styles.titles}>
          <Text {...a11yHeader(title)} variant="title">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="micro" color="textSecondary">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing ? (
          <Text variant="caption" color="textSecondary">
            {trailing}
          </Text>
        ) : null}
      </View>
      {children}
    </ProfileCard>
  );
}

/** "Your roles" over a list, with an optional quiet note at the other end (573:38). */
export function SectionHeading({ title, note }: { title: string; note?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.heading}>
      <Text {...a11yHeader(title)} variant="title" style={styles.titles}>
        {title}
      </Text>
      {note ? (
        <Text variant="caption" color="textSecondary">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: s(HEADER_GAP) },
  iconSlot: {
    width: s(ICON_SLOT_W),
    height: s(ICON_SLOT_H),
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, gap: s(TITLE_GAP) },
  heading: { flexDirection: 'row', alignItems: 'center', gap: s(8 / 0.75) },
}));
