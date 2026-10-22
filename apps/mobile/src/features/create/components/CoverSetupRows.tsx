import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import type { ComponentProps, ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { CoverLetterTone, Job, Resume } from '@/data/models';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { coverResumeMeta, coverSetupHero } from '../coverLetterSetup';
import { FLOW_ART, FlowHero } from './FlowHero';
import { CoverLetterTonePicker } from './CoverLetterTonePicker';
import { jobMetaLine } from './TailorVsCard';

// COVER 01 at 390 (644:36 job row, 644:47 resume row, 644:41 doc tile), in artboard units.
const ROW_PAD_X = 15 / 0.75;
const ROW_PAD_Y = 13 / 0.75;
const ROW_GAP = 12 / 0.75;
const LINE_GAP = 2 / 0.75;
const CHEVRON = 9 / 0.75;
const TILE = 34 / 0.75;
const TILE_RADIUS = 9 / 0.75;
const TILE_GLYPH = 12 / 0.75;
const SECTION_TO_ROW = 10 / 0.75; // 644:33 → 644:36
const HERO_TO_SECTION = 22 / 0.75; // 644:29 → 644:33
const ROW_TO_SECTION = 18 / 0.75; // 644:36 → 644:44, 644:47 → 644:53

/**
 * One labelled pick on COVER 01: "Job" or "Resume" over a white card that names the current
 * choice and opens the picker. Read as one button: "Job: Senior Product Designer, Stripe ·
 * Bengaluru · Remote".
 */
export function CoverPickSection({
  label,
  title,
  meta,
  leading,
  hint,
  onPress,
}: {
  label: string;
  title: string;
  meta: string;
  leading?: ReactNode;
  hint: string;
  onPress: () => void;
}) {
  const { colors, radii, shadows, sizes, s } = useTheme();
  const styles = useStyles();

  return (
    <View>
      <Text variant="title" {...a11yHeader(label)}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${title}, ${meta}`}
        accessibilityHint={hint}
        feedback="subtle"
        haptic="light"
        onPress={onPress}
        style={[
          styles.row,
          shadows.card,
          {
            backgroundColor: colors.surfaceCard,
            borderColor: colors.borderHairline,
            borderWidth: sizes.border,
            // The board's 18 at 390: the same corner as every card on the page.
            borderRadius: radii.cardLg,
          },
        ]}
      >
        {leading}
        <View style={styles.text}>
          <Text variant="label" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <FontAwesome5 name="chevron-right" size={s(CHEVRON)} color={colors.iconChevron} solid />
      </Pressable>
    </View>
  );
}

/** The grey document tile that leads the resume row (644:41). */
export function CoverDocTile() {
  const { colors, s } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.tile, { backgroundColor: colors.surfaceSubtle }]}>
      <FontAwesome5 name="bars" size={s(TILE_GLYPH)} color={colors.textBody} solid />
    </View>
  );
}

/**
 * COVER 01 under the stepper, once everything has loaded: the drawing and hero, the Job and
 * Resume picks, and the tones. Without a job (a resume tailored for none) the Job section is
 * left out and the hero says only what the letter is made from. Each block enters on the
 * screen's stagger, in reading order.
 */
export function CoverSetupSections({
  job,
  resume,
  tone,
  onTone,
  onPick,
  enter,
}: {
  job?: Job;
  resume: Resume;
  tone: CoverLetterTone;
  onTone: (tone: CoverLetterTone) => void;
  /** Either row opens the job sheet: a job and its tailored resume are picked together. */
  onPick: () => void;
  enter: (index: number) => ComponentProps<typeof Animated.View>['entering'];
}) {
  const { s } = useTheme();
  const hero = coverSetupHero(job != null);

  return (
    <>
      <Animated.View entering={enter(0)}>
        <FlowHero title={hero.title} lede={hero.lede} art={FLOW_ART.coverSetup} />
      </Animated.View>
      {job ? (
        <Animated.View entering={enter(1)} style={{ marginTop: s(HERO_TO_SECTION) }}>
          <CoverPickSection
            label="Job"
            title={job.title}
            meta={jobMetaLine(job)}
            hint="Pick a different job for the letter"
            onPress={onPick}
          />
        </Animated.View>
      ) : null}
      <Animated.View
        entering={enter(2)}
        style={{ marginTop: s(job ? ROW_TO_SECTION : HERO_TO_SECTION) }}
      >
        <CoverPickSection
          label="Resume"
          title={resume.title}
          meta={coverResumeMeta(resume)}
          leading={<CoverDocTile />}
          hint="Pick a different resume for the letter"
          onPress={onPick}
        />
      </Animated.View>
      <Animated.View entering={enter(3)} style={{ marginTop: s(ROW_TO_SECTION) }}>
        <CoverLetterTonePicker value={tone} onChange={onTone} />
      </Animated.View>
    </>
  );
}

const useStyles = scaledSheet((s) => ({
  row: {
    marginTop: s(SECTION_TO_ROW),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(ROW_GAP),
    paddingHorizontal: s(ROW_PAD_X),
    paddingVertical: s(ROW_PAD_Y),
  },
  text: { flex: 1, gap: s(LINE_GAP) },
  tile: {
    width: s(TILE),
    height: s(TILE),
    borderRadius: s(TILE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
