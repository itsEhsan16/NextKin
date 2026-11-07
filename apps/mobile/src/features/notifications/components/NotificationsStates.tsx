import type { FC } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';

import AiResultsIcon from '../../../../assets/icons/create/tailor.svg';
import ApplicationsIcon from '../../../../assets/icons/notifications/arrive-applications.svg';
import ClosingIcon from '../../../../assets/icons/notifications/arrive-closing.svg';
import MatchesIcon from '../../../../assets/icons/notifications/arrive-matches.svg';
import EmptyBellIcon from '../../../../assets/icons/notifications/empty-bell.svg';
import CaughtUpIllustration from '../../../../assets/illustrations/notifications-caught-up.svg';
import { a11yButton, a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

/** NOTIF 05's illustration (Figma 395:1409), drawn 289.5 × 221.25 at 390. */
const CAUGHT_UP_ART = { w: 289.5 / 0.75, h: 221.25 / 0.75 } as const;
/** Respaced board (toreview.md 38.1): art → title 14.75 at 390, lede → CTA 28.5. */
const CAUGHT_UP_TITLE_TOP = 14.75 / 0.75;
const CAUGHT_UP_CTA_EXTRA = 28.5 / 0.75;

/**
 * NOTIF 05 (Figma 95:2967) — the feed with nothing left to show under the active filter. Centred
 * in the space under the filters, as the board draws it.
 */
export function NotificationsCaughtUp({ onExplore }: { onExplore: () => void }) {
  const { spacing, s } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.center, styles.fill, { paddingVertical: spacing[6], gap: spacing[3] }]}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        // The column's gap is part of the seam, so the margin carries only the rest of it.
        style={{ marginBottom: s(CAUGHT_UP_TITLE_TOP) - spacing[3] }}
      >
        <CaughtUpIllustration width={s(CAUGHT_UP_ART.w)} height={s(CAUGHT_UP_ART.h)} />
      </View>
      <Text {...a11yHeader()} variant="headline" align="center">
        {"You're all caught up"}
      </Text>
      <Text variant="body" color="textSecondary" align="center" style={styles.lede}>
        New matches, application updates and AI results will land here.
      </Text>
      <Button
        label="Explore today's matches"
        onPress={onExplore}
        style={{ marginTop: s(CAUGHT_UP_CTA_EXTRA) - spacing[3] }}
      />
    </View>
  );
}

/** One "what arrives" row of NOTIF 06 (Figma 95:2999). */
type ArrivalRow = {
  key: string;
  /** Each row's illustrated tile (505:93 / 505:102 / 505:114 / 505:137), 39 at 390. */
  Icon: FC<SvgProps>;
  /** Drawn height over 0.75: AI results is the wand, a hair under square. */
  h: number;
  title: string;
  caption: string;
};

/** NOTIF 06's rows: a 54 pitch at 390 with 39 tiles 14.25 in and the text 12 after them. */
const ARRIVAL_ICON = 52;
const ARRIVAL_PAD_X = 14.25 / 0.75;
const ARRIVAL_PAD_Y = (54 - 39) / 2 / 0.75;
const ARRIVAL_TEXT_X = 65.25 / 0.75;

const ARRIVALS: readonly ArrivalRow[] = [
  {
    key: 'matches',
    Icon: MatchesIcon,
    h: ARRIVAL_ICON,
    title: 'New matches',
    caption: 'One batch a day, refreshed each morning',
  },
  {
    key: 'closing',
    Icon: ClosingIcon,
    h: ARRIVAL_ICON,
    title: 'Saved jobs closing',
    caption: '48 hours before the deadline',
  },
  {
    key: 'applications',
    Icon: ApplicationsIcon,
    h: ARRIVAL_ICON,
    title: 'Application updates',
    caption: 'Viewed, stage changes, decisions',
  },
  {
    key: 'ai',
    Icon: AiResultsIcon,
    h: 38.9951 / 0.75,
    title: 'AI results',
    caption: 'Scores, cover letters, tailored drafts',
  },
] as const;

/** The empty bell (505:70): an 80 box at 390 holding 80 × 61.48 of art. */
const BELL_BOX = 80 / 0.75;
const BELL_ART = { w: 80 / 0.75, h: 61.4829 / 0.75 } as const;
/**
 * Respaced board, at 390: bell box → title 24, title → lede 8.5, lede → card 32.75, card → CTA
 * 28, CTA → footnote 23. The column's own gap is part of each of the last three.
 */
const BELL_BOTTOM = 24 / 0.75;
const LEDE_TOP = 8.5 / 0.75;
const CARD_TOP = 32.75 / 0.75;
const CTA_TOP = 28 / 0.75;
const FOOTNOTE_TOP = 23 / 0.75;

/** NOTIF 06 (Figma 95:2989) — the feed before anything has ever arrived. */
export function NotificationsFirstUse({ onPreferences }: { onPreferences: () => void }) {
  const { colors, radii, sizes, spacing, s } = useTheme();
  const styles = useStyles();
  const gap = spacing[3];

  return (
    <View style={{ paddingVertical: spacing[6], gap }}>
      <View style={styles.center}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.center,
            { height: s(BELL_BOX), justifyContent: 'center', marginBottom: s(BELL_BOTTOM) },
          ]}
        >
          <EmptyBellIcon width={s(BELL_ART.w)} height={s(BELL_ART.h)} />
        </View>
        <Text {...a11yHeader()} variant="displaySemiBold" align="center">
          Nothing here yet
        </Text>
        <Text
          variant="body"
          color="textSecondary"
          align="center"
          style={{ marginTop: s(LEDE_TOP) }}
        >
          This is what NextKin will tell you about:
        </Text>
      </View>

      <Card radius="card" padding={0} style={{ marginTop: s(CARD_TOP) - gap }}>
        {ARRIVALS.map((row, index) => (
          <View
            key={row.key}
            accessible
            accessibilityLabel={`${row.title}: ${row.caption}`}
            style={[
              styles.arrival,
              {
                gap: s(ARRIVAL_TEXT_X - ARRIVAL_PAD_X - ARRIVAL_ICON),
                paddingHorizontal: s(ARRIVAL_PAD_X),
                paddingVertical: s(ARRIVAL_PAD_Y),
              },
            ]}
          >
            {index > 0 ? (
              <View
                style={[
                  styles.arrivalDivider,
                  { backgroundColor: colors.divider, left: s(ARRIVAL_TEXT_X) },
                ]}
              />
            ) : null}
            <View style={[styles.center, { width: s(ARRIVAL_ICON) }]}>
              <row.Icon width={s(ARRIVAL_ICON)} height={s(row.h)} />
            </View>
            <View style={styles.arrivalText}>
              <Text variant="titleSm">{row.title}</Text>
              <Text variant="captionSm" color="textSecondary">
                {row.caption}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <Pressable
        {...a11yButton('Choose what you get notified about')}
        feedback="scale"
        onPress={onPreferences}
        style={[
          styles.prefsCta,
          {
            // The control height every full-width CTA uses; a flat s(56) was 42 on a phone.
            height: sizes.buttonLg,
            borderRadius: radii.xl,
            borderColor: colors.borderDefault,
            backgroundColor: colors.surfaceCard,
            marginTop: s(CTA_TOP) - gap,
          },
        ]}
      >
        <Text variant="bodySemiBold" align="center">
          Choose what you get notified about
        </Text>
      </Pressable>
      <Text
        variant="caption"
        color="textSecondary"
        align="center"
        style={{ marginTop: s(FOOTNOTE_TOP) - gap }}
      >
        We only send what you switch on.
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  center: { alignItems: 'center' },
  fill: { flex: 1, justifyContent: 'center' },
  lede: { maxWidth: s(320) },
  arrival: { flexDirection: 'row', alignItems: 'center' },
  arrivalDivider: { position: 'absolute', top: 0, right: 0, height: StyleSheet.hairlineWidth },
  arrivalText: { flex: 1, gap: s(1) },
  prefsCta: { borderWidth: s(1), alignItems: 'center', justifyContent: 'center' },
}));
