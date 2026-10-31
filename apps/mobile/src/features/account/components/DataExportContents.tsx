import { Fragment } from 'react';
import { View } from 'react-native';

import NewResumeArt from '../../../../assets/icons/create/new-resume.svg';
import HistoryArt from '../../../../assets/icons/shortcuts/history.svg';
import SavedJobsArt from '../../../../assets/icons/shortcuts/saved-jobs.svg';
import { Art, ProfileCard } from '@/features/profile/components/cards';
import { PROFILE_ROW_ART } from '@/features/profile/profileRowArt';
import { a11yButton, a11yHeader, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import type { ListRowArt } from '@/ui/ListRow';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import {
  DATA_EXPORT_CONTENTS,
  DATA_EXPORT_CONTENTS_TITLE,
  DATA_EXPORT_PRIVACY_LINE,
  type DataExportSection,
} from '../dataExportCopy';
import { Icon } from '@/ui/Icon';

// ACCOUNT 02 at 390 (577:3105, 577:3210) and ACCOUNT 03 (577:3849), in artboard units.
const HEADING_TO_CARD = 12 / 0.75;
const CARD_PAD_Y = 3 / 0.75;
const ROW_PAD_X = 15 / 0.75;
const ROW_PAD_Y = 12 / 0.75;
const ROW_GAP = 12 / 0.75;
const TILE = 39 / 0.75;
const TILE_RADIUS = 10 / 0.75;
const LINE_GAP = 2 / 0.75;
const DIVIDER_INSET = 66 / 0.75;
const PRIVACY_PAD_Y = 2 / 0.75;
const PRIVACY_ROW_PAD_L = 10 / 0.75;
const PRIVACY_ROW_PAD_R = 14 / 0.75;
const PRIVACY_ROW_PAD_Y = 11 / 0.75;
const PRIVACY_ROW_GAP = 10 / 0.75;
const PRIVACY_SLOT_W = 36 / 0.75;
const PRIVACY_SLOT_H = 30 / 0.75;
const PRIVACY_ART_W = 32 / 0.75;
const LINK_GAP = 4.5 / 0.75;
const LINK_H = 16 / 0.75;

/**
 * Each section's drawing and the width the board draws it at. Four sit on the brand tile; the
 * documents drawing brings its own (577:3142), so it is drawn at the tile's full width instead.
 */
const SECTION_ART: Record<
  DataExportSection['key'],
  { art: ListRowArt; width: number; tile: boolean }
> = {
  account: { art: PROFILE_ROW_ART.emailPassword, width: 27, tile: true },
  profile: { art: PROFILE_ROW_ART.experience, width: 30.03, tile: true },
  documents: { art: { Icon: NewResumeArt, w: 39, h: 38.907 }, width: 39, tile: false },
  savedJobs: { art: { Icon: SavedJobsArt, w: 28, h: 39.695 }, width: 17, tile: true },
  activity: { art: { Icon: HistoryArt, w: 44, h: 44.6335 }, width: 26, tile: true },
};

function SectionRow({ section }: { section: DataExportSection }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const look = SECTION_ART[section.key];

  return (
    <View accessible accessibilityLabel={`${section.title}. ${section.body}`} style={styles.row}>
      <View style={[styles.tile, look.tile ? { backgroundColor: colors.tileBrandStrong } : null]}>
        <Art art={look.art} width={look.width / 0.75} />
      </View>
      <View style={styles.text}>
        <Text variant="label">{section.title}</Text>
        <Text variant="micro" color="textSecondary">
          {section.body}
        </Text>
      </View>
    </View>
  );
}

/** "What the file holds" over one card of the payload's sections (ACCOUNT 02 577:3102). */
export function DataExportContents() {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View>
      <Text {...a11yHeader()} variant="title">
        {DATA_EXPORT_CONTENTS_TITLE}
      </Text>
      <ProfileCard style={styles.contentsCard}>
        {DATA_EXPORT_CONTENTS.map((section, index) => (
          <Fragment key={section.key}>
            {index > 0 ? (
              <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            ) : null}
            <SectionRow section={section} />
          </Fragment>
        ))}
      </ProfileCard>
    </View>
  );
}

/** The privacy policy as a card row with its own explainer (ACCOUNT 02 577:3210). */
export function PrivacyPolicyRow({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <ProfileCard style={styles.privacyCard}>
      <Pressable
        {...a11yButton('Privacy policy', DATA_EXPORT_PRIVACY_LINE)}
        feedback="subtle"
        onPress={onPress}
        style={styles.privacyRow}
      >
        <View style={styles.privacySlot}>
          <Art art={PROFILE_ROW_ART.privacy} width={PRIVACY_ART_W} />
        </View>
        <View style={styles.text}>
          <Text variant="menuRow">Privacy policy</Text>
          <Text variant="micro" color="textSecondary">
            {DATA_EXPORT_PRIVACY_LINE}
          </Text>
        </View>
        <Icon name="ChevronRight" size="sm" color={colors.iconChevron} />
      </Pressable>
    </ProfileCard>
  );
}

/** The quieter centred link the ready state ends on (ACCOUNT 03 577:3846). */
export function PrivacyPolicyLink({ onPress }: { onPress: () => void }) {
  const { colors, s } = useTheme();
  const styles = useStyles();

  return (
    <Pressable
      {...a11yButton('Privacy policy')}
      feedback="subtle"
      hitSlop={hitSlopFor(s(LINK_H))}
      onPress={onPress}
      style={styles.link}
    >
      <Text variant="microBadge" color="brand">
        Privacy policy
      </Text>
      <Icon name="ChevronRight" size="sm" color={colors.brand} />
    </Pressable>
  );
}

const useStyles = scaledSheet((s) => ({
  contentsCard: { marginTop: s(HEADING_TO_CARD), paddingVertical: s(CARD_PAD_Y) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(ROW_GAP),
    paddingHorizontal: s(ROW_PAD_X),
    paddingVertical: s(ROW_PAD_Y),
  },
  tile: {
    width: s(TILE),
    height: s(TILE),
    borderRadius: s(TILE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: s(LINE_GAP) },
  divider: { height: 1, marginLeft: s(DIVIDER_INSET) },
  privacyCard: { paddingVertical: s(PRIVACY_PAD_Y) },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(PRIVACY_ROW_GAP),
    paddingLeft: s(PRIVACY_ROW_PAD_L),
    paddingRight: s(PRIVACY_ROW_PAD_R),
    paddingVertical: s(PRIVACY_ROW_PAD_Y),
  },
  privacySlot: {
    width: s(PRIVACY_SLOT_W),
    height: s(PRIVACY_SLOT_H),
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: s(LINK_GAP),
  },
}));
