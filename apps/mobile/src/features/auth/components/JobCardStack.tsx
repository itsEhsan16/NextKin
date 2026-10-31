import { View } from 'react-native';

import JobSeeker from '../../../../assets/onboarding/job-seeker.svg';
import GoogleLogo from '../../../../assets/logos/google.svg';
import NotionLogo from '../../../../assets/logos/notion.svg';
import SpotifyLogo from '../../../../assets/logos/spotify.svg';
import { board } from '../board';
import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

/** Figma 290:1041 — the illustration box the cards and figure are placed inside. */
const BOX = { width: 351.66, height: 389 };
const CARD = { width: 272, height: 91, radius: 12, logo: 43 };
const FIGURE = { width: 224, height: 219.793, x: 146.66, y: 171.22 };

/** Each card's offset inside the box and the tilt it is drawn at. */
const CARDS = [
  { title: 'Product Designer', x: -2.19, y: 7.18, rotate: '-3deg', Logo: GoogleLogo },
  { title: 'UX Designer', x: 4.94, y: 104.7, rotate: '-2.8deg', Logo: NotionLogo },
  { title: 'UI Designer', x: 8.08, y: 203.22, rotate: '-2.6deg', Logo: SpotifyLogo },
] as const;

/** The two grey rules standing in for a job's meta line. */
const BARS = [
  { width: 105, height: 5 },
  { width: 69, height: 5 },
] as const;

/**
 * Onboarding slide 2's illustration (Figma 290:1041): three tilted job cards with a figure
 * reading them. The card copy is drawn content, not data — these are not real listings, so they
 * come from the artboard rather than the mock repos.
 */
export function JobCardStack() {
  const { colors, radii, artboardShadows, s } = useTheme();
  const styles = useStyles();

  return (
    // One decorative image as far as a screen reader is concerned; the slide's heading carries
    // the meaning and reading three fake job titles out would only get in the way.
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Job matches from top companies"
      style={{ width: s(board(BOX.width)), height: s(board(BOX.height)) }}
    >
      {CARDS.map(({ title, x, y, rotate, Logo }) => (
        <View
          key={title}
          style={[
            styles.card,
            artboardShadows.card,
            {
              left: s(board(x)),
              top: s(board(y)),
              width: s(board(CARD.width)),
              height: s(board(CARD.height)),
              paddingHorizontal: s(board(20)),
              gap: s(board(21)),
              borderRadius: s(board(CARD.radius)),
              borderWidth: s(board(1)),
              borderColor: colors.borderHairline,
              backgroundColor: colors.surfaceCard,
              transform: [{ rotate }],
            },
          ]}
        >
          <Logo width={s(board(CARD.logo))} height={s(board(CARD.logo))} />
          <View style={[styles.copy, { gap: s(board(9)) }]}>
            <Text variant="jobCardTitle" color="onboardingInk">
              {title}
            </Text>
            <View style={{ gap: s(board(7)) }}>
              {BARS.map(({ width, height }) => (
                <View
                  key={width}
                  style={{
                    width: s(board(width)),
                    height: s(board(height)),
                    borderRadius: radii.full,
                    backgroundColor: colors.jobCardBar,
                  }}
                />
              ))}
            </View>
          </View>
        </View>
      ))}

      <View style={{ position: 'absolute', left: s(board(FIGURE.x)), top: s(board(FIGURE.y)) }}>
        <JobSeeker width={s(board(FIGURE.width))} height={s(board(FIGURE.height))} />
      </View>
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  card: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1 },
}));
