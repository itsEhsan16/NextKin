import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import { resolveLogoSvg } from '@/assets';
import type { Job } from '@/data/models';
import { a11yHeader, formatJobMeta, initialOf } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { LogoTile } from '@/ui/LogoTile';
import { Text } from '@/ui/Text';

export type CompanyHeroProps = { job: Job };

// JOBS 09 at 390 (580:1655), in artboard units.
const LOGO = 68 / 0.75;
const LOGO_RADIUS = 20 / 0.75;
const LOGO_TO_NAME = 14 / 0.75;
const NAME_GAP = 6 / 0.75;
const VERIFIED = 17 / 0.75;
const VERIFIED_TICK = 7.192 / 0.75;
const NAME_TO_META = 4 / 0.75;

/**
 * Who the employer is, centred (JOBS 09 580:1655): a 68 mark, the name with the verified badge
 * Job Detail uses (only where the listing carries it — it is a trust claim), and the profile
 * line the job detail's company card already shows.
 */
export function CompanyHero({ job }: CompanyHeroProps) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  // `formatJobMeta` drops the empty entries and owns the separator, so a company missing either
  // half of its profile reads as one clean line rather than a stranded "·".
  const meta = formatJobMeta([job.companyIndustry, job.companySize]);

  return (
    <View style={styles.root}>
      {resolveLogoSvg(job.companyLogoUrl) ? (
        <LogoTile name={job.company} logoUrl={job.companyLogoUrl} size={s(LOGO)} />
      ) : (
        // The board sets the initial at 29 on a grey r20 tile — larger than LogoTile's own steps.
        <View
          accessibilityRole="image"
          accessibilityLabel={`${job.company} logo`}
          style={[styles.tile, { backgroundColor: colors.surfaceSubtle }]}
        >
          <Text variant="companyInitial">{initialOf(job.company)}</Text>
        </View>
      )}

      <View style={styles.nameRow}>
        <Text {...a11yHeader()} variant="screenTitle" numberOfLines={1} style={styles.shrink}>
          {job.company}
        </Text>
        {job.companyVerified ? (
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel="Verified company"
            style={styles.verified}
          >
            <FontAwesome5 name="certificate" size={s(VERIFIED)} color={colors.brand} solid />
            <FontAwesome5
              name="check"
              size={s(VERIFIED_TICK)}
              color={colors.textOnBrand}
              solid
              style={styles.tick}
            />
          </View>
        ) : null}
      </View>

      {meta ? (
        <Text variant="micro" color="textSecondary" align="center" style={styles.meta}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  root: { alignItems: 'center' },
  tile: {
    width: s(LOGO),
    height: s(LOGO),
    borderRadius: s(LOGO_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(NAME_GAP),
    marginTop: s(LOGO_TO_NAME),
    maxWidth: '100%',
  },
  shrink: { flexShrink: 1 },
  verified: {
    width: s(VERIFIED),
    height: s(VERIFIED),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { position: 'absolute' },
  meta: { marginTop: s(NAME_TO_META) },
}));
