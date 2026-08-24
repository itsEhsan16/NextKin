import { StyleSheet, View } from 'react-native';

import { EMPLOYMENT_TYPE_LABEL, REMOTE_TYPE_LABEL, type Job } from '@/data/models';
import { formatJobMeta, formatRelativeTime, formatSalaryLong } from '@/lib';
import { useTheme } from '@/theme';
import { Chip } from '@/ui/Chip';
import { LogoTile } from '@/ui/LogoTile';
import { Text } from '@/ui/Text';

export type JobDetailHeroProps = { job: Job };

const LOGO = 64;

/**
 * Title block of JOBS 05 (Figma 1:837–1:850): logo, role, company meta line, salary and the
 * three grey meta chips.
 *
 * The employee-count chip reads the same `companySize` as the company card further down — the
 * artboard puts "51–200 employees" here and "8,000+ employees" there for the same company.
 */
export function JobDetailHero({ job }: JobDetailHeroProps) {
  const { spacing, radii } = useTheme();

  return (
    <View style={{ gap: spacing[4] }}>
      <LogoTile
        name={job.company}
        logoUrl={job.companyLogoUrl}
        size={LOGO}
        style={{ borderRadius: radii.xxl }}
      />

      <View style={{ gap: spacing[2] }}>
        <Text variant="displayLg" accessibilityRole="header">
          {job.title}
        </Text>
        <Text variant="bodyMedium" color="textSecondary">
          {formatJobMeta([job.company, job.location, REMOTE_TYPE_LABEL[job.remote]])}
        </Text>
      </View>

      {job.salary ? (
        // Two runs at different sizes, so the "· est." qualifier is its own node (Figma 1:841).
        <View style={[styles.salary, { gap: spacing[2] }]}>
          <Text variant="display">{formatSalaryLong(job.salary)}</Text>
          {job.salary.estimated ? (
            <Text variant="caption" color="textSecondary">
              · est.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.chips, { gap: spacing[2] }]}>
        <Chip label={EMPLOYMENT_TYPE_LABEL[job.employmentType]} />
        <Chip label={`Posted ${formatRelativeTime(job.postedAt)}`} />
        <Chip label={job.companySize} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  salary: { flexDirection: 'row', alignItems: 'baseline' },
  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
