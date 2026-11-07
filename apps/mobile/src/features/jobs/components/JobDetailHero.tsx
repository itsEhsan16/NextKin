import { View } from 'react-native';

import { EMPLOYMENT_TYPE_LABEL, REMOTE_TYPE_LABEL, type Job } from '@/data/models';
import { formatJobMeta, formatRelativeTime, formatSalaryLong } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Icon, type LineIconName } from '@/ui/Icon';
import { LogoTile } from '@/ui/LogoTile';
import { Text } from '@/ui/Text';

export type JobDetailHeroProps = { job: Job };

const WORKPLACE_ICON: Record<Job['remote'], LineIconName> = {
  remote: 'Wifi',
  hybrid: 'Building02',
  onsite: 'Building02',
};

/** A white fact chip with a brand icon, as the job description page draws them (§180). */
function Fact({ icon, label }: { icon: LineIconName; label: string }) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  return (
    <View
      style={[styles.fact, { backgroundColor: colors.surfaceCard, borderColor: colors.borderSoft }]}
    >
      <Icon name={icon} size={u(15)} color={colors.brand} />
      <Text variant="footnote" color="ink" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The top of a job (owner, 2026-11-08: "redesign the job description", §182), matching the job
 * description page: the company's tile, name and line, the role as the title, the salary under
 * it, then the job's facts as chips — where, how, what kind, when posted, how big.
 */
export function JobDetailHero({ job }: JobDetailHeroProps) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  const workplace = REMOTE_TYPE_LABEL[job.remote];
  // Linear's location already says "Remote (India)"; a second "Remote" would repeat it.
  const showWorkplace = !job.location.toLowerCase().includes(workplace.toLowerCase());

  return (
    <View style={styles.wrap}>
      <View style={styles.company}>
        <LogoTile
          name={job.company}
          logoUrl={job.companyLogoUrl}
          size={u(52)}
          style={{ borderRadius: u(16) }}
        />
        <View style={styles.companyCopy}>
          <View style={styles.nameRow}>
            <Text variant="bodyLgStrong" color="ink" numberOfLines={1} style={styles.shrink}>
              {job.company}
            </Text>
            {job.companyVerified ? (
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel="Verified company"
                style={[styles.verified, { width: u(18), height: u(18) }]}
              >
                <Icon name="Award01" size="sm" color={colors.brand} />
                <Icon name="Check" size="xs" color={colors.textOnBrand} style={styles.tick} />
              </View>
            ) : null}
          </View>
          <Text variant="footnote" color="textSecondary" numberOfLines={1}>
            {formatJobMeta([job.companyIndustry, job.companySize])}
          </Text>
        </View>
      </View>

      <Text variant="title1" color="ink" accessibilityRole="header">
        {job.title}
      </Text>

      {job.salary ? (
        <View style={styles.salary}>
          {/* The redraw spaces the range out: "₹28 – 38 LPA" (443:14). */}
          <Text variant="title3" color="ink">
            {formatSalaryLong(job.salary).replace('–', ' – ')}
          </Text>
          {job.salary.estimated ? (
            <>
              <Text variant="footnote" color="textSecondary">
                · Estimated
              </Text>
              <Icon name="InfoCircle" size={u(14)} color={colors.iconMuted} />
            </>
          ) : null}
        </View>
      ) : null}

      <View style={styles.facts}>
        <Fact icon="MarkerPin01" label={job.location} />
        {showWorkplace ? <Fact icon={WORKPLACE_ICON[job.remote]} label={workplace} /> : null}
        <Fact icon="Briefcase01" label={EMPLOYMENT_TYPE_LABEL[job.employmentType]} />
        <Fact icon="Clock" label={`Posted ${formatRelativeTime(job.postedAt)}`} />
        {/* A job added from a copied link (TAILOR 00c) knows no head count. */}
        {job.companySize ? <Fact icon="Users01" label={job.companySize} /> : null}
      </View>
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  wrap: { gap: u(14) },
  company: { flexDirection: 'row', alignItems: 'center', gap: u(12) },
  companyCopy: { flex: 1, gap: u(2) },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  shrink: { flexShrink: 1 },
  verified: { alignItems: 'center', justifyContent: 'center' },
  tick: { position: 'absolute' },
  salary: { flexDirection: 'row', alignItems: 'center', gap: u(6), marginTop: -u(4) },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8) },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(6),
    paddingHorizontal: u(12),
    paddingVertical: u(7),
    borderRadius: u(999),
    borderWidth: 1,
  },
}));
