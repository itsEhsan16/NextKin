import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import { EMPLOYMENT_TYPE_LABEL, REMOTE_TYPE_LABEL, type Job } from '@/data/models';
import { formatJobMeta, formatRelativeTime, formatSalaryLong } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { LogoTile } from '@/ui/LogoTile';
import { Text } from '@/ui/Text';

import { MetaPill } from './JobPills';

export type JobDetailHeroProps = { job: Job };

/**
 * Drawn values over 0.75 (Figma 443:2 is the 390 board). A 48 logo with the company beside it
 * 12 away; then 14 to the title, 8 to the location line, 10 to the salary and 15 to the chips.
 */
const HERO = {
  logo: 64,
  logoGap: 16,
  titleGap: 18.6667,
  locationGap: 10.6667,
  salaryGap: 13.3333,
  chipsGap: 20,
  verified: 17.3333,
  verifiedTick: 7.3333,
  nameGap: 6.6667,
  rowIcon: 14.6667,
  rowGap: 9.3333,
  rule: 17.3333,
  salaryInfo: 14.6667,
  salaryGapX: 8,
  chipGap: 8,
};

/** The board draws Remote with wifi. The other two are not drawn; a building reads as an office. */
const WORKPLACE_ICON: Record<Job['remote'], string> = {
  remote: 'wifi',
  hybrid: 'building',
  onsite: 'building',
};

/**
 * Title block of JOBS 05, redrawn (Figma 443:9–443:22): the company beside its logo, the role, a
 * location line, the salary and three meta chips — each now led by a glyph.
 *
 * The employee-count chip reads the same `companySize` as the subtitle above it and the company
 * card below — the board puts "51–200 employees" here and "8,000+" there for the same company.
 */
export function JobDetailHero({ job }: JobDetailHeroProps) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();
  const workplace = REMOTE_TYPE_LABEL[job.remote];

  return (
    <View>
      <View style={styles.company}>
        <LogoTile
          name={job.company}
          logoUrl={job.companyLogoUrl}
          size={s(HERO.logo)}
          style={{ borderRadius: radii.xxl }}
        />
        <View style={styles.companyCopy}>
          <View style={styles.nameRow}>
            <Text variant="title" numberOfLines={1} style={styles.shrink}>
              {job.company}
            </Text>
            {job.companyVerified ? (
              // A brand certificate with a white tick laid over it, as 443:105 stacks the two.
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel="Verified company"
                style={[styles.verified, { width: s(HERO.verified), height: s(HERO.verified) }]}
              >
                <FontAwesome5
                  name="certificate"
                  size={s(HERO.verified)}
                  color={colors.brand}
                  solid
                />
                <FontAwesome5
                  name="check"
                  size={s(HERO.verifiedTick)}
                  color={colors.textOnBrand}
                  solid
                  style={styles.tick}
                />
              </View>
            ) : null}
          </View>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {formatJobMeta([job.companyIndustry, job.companySize])}
          </Text>
        </View>
      </View>

      <Text variant="displayLg" accessibilityRole="header" style={{ marginTop: s(HERO.titleGap) }}>
        {job.title}
      </Text>

      <View style={[styles.row, { marginTop: s(HERO.locationGap) }]}>
        <FontAwesome5
          name="map-marker-alt"
          size={s(HERO.rowIcon)}
          color={colors.textSecondary}
          solid
        />
        <Text variant="bodyMedium" color="textSecondary" numberOfLines={1} style={styles.shrink}>
          {job.location}
        </Text>
        {/* Linear's location already says "Remote (India)"; a second "Remote" would repeat it. */}
        {job.location.toLowerCase().includes(workplace.toLowerCase()) ? null : (
          <>
            <View style={[styles.rule, { backgroundColor: colors.borderDashed }]} />
            <FontAwesome5
              name={WORKPLACE_ICON[job.remote]}
              size={s(HERO.rowIcon)}
              color={colors.textSecondary}
              solid
            />
            <Text variant="bodyMedium" color="textSecondary">
              {workplace}
            </Text>
          </>
        )}
      </View>

      {job.salary ? (
        <View style={[styles.salary, { marginTop: s(HERO.salaryGap) }]}>
          {/* The redraw spaces the range out: "₹28 – 38 LPA" (443:14). */}
          <Text variant="jobDetailSalary">{formatSalaryLong(job.salary).replace('–', ' – ')}</Text>
          {job.salary.estimated ? (
            <>
              <Text variant="caption" color="textSecondary">
                · Estimated
              </Text>
              <FontAwesome5
                name="info-circle"
                size={s(HERO.salaryInfo)}
                color={colors.iconMuted}
                solid
                // Decoration: "Estimated" already says it, and there is nothing behind the icon.
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.chips, { marginTop: s(HERO.chipsGap) }]}>
        <MetaPill label={EMPLOYMENT_TYPE_LABEL[job.employmentType]} icon="briefcase" />
        <MetaPill label={`Posted ${formatRelativeTime(job.postedAt)}`} icon="clock" iconRegular />
        {/* A job added from a copied link (TAILOR 00c) knows no head count. */}
        {job.companySize ? <MetaPill label={job.companySize} icon="users" /> : null}
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  company: { flexDirection: 'row', alignItems: 'center', gap: s(HERO.logoGap) },
  companyCopy: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: s(HERO.nameGap) },
  shrink: { flexShrink: 1 },
  verified: { alignItems: 'center', justifyContent: 'center' },
  tick: { position: 'absolute' },
  row: { flexDirection: 'row', alignItems: 'center', gap: s(HERO.rowGap) },
  rule: { width: s(1), height: s(HERO.rule) },
  salary: { flexDirection: 'row', alignItems: 'center', gap: s(HERO.salaryGapX) },
  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: s(HERO.chipGap) },
}));
