import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { EMPLOYMENT_TYPE_LABEL, type Job } from '@/data/models';
import { a11yButton, formatPercent, formatRelativeTime } from '@/lib';
import { useLayoutScale, useTheme } from '@/theme';
import { AvatarStack } from '@/ui/Avatar';
import { StatBadge } from '@/ui/Badge';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { LogoTile } from '@/ui/LogoTile';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type JobMatchCardProps = {
  job: Job;
  width: number;
  onPress: (job: Job) => void;
};

const applicantsCopy = (count: number | undefined) =>
  count == null ? undefined : `${count}+ applied`;

/**
 * The card is one tappable element, so everything inside it (match badge, chips, social proof)
 * is collapsed for screen readers — the label has to carry those values itself.
 */
function jobSummary(job: Job): string {
  const parts = [job.title, `at ${job.company}`];
  if (job.matchScore != null) parts.push(`${formatPercent(job.matchScore)} match`);
  parts.push(EMPLOYMENT_TYPE_LABEL[job.employmentType]);
  parts.push(`posted ${formatRelativeTime(job.postedAt)}`);
  const applicants = applicantsCopy(job.applicantsCount);
  if (applicants) parts.push(applicants);
  return parts.join(', ');
}

/** Figma 1:101 — 288px card: logo + match badge, company, role, meta chips, social proof. */
export const JobMatchCard = memo(function JobMatchCard({ job, width, onPress }: JobMatchCardProps) {
  const { spacing } = useTheme();
  const { s } = useLayoutScale();

  return (
    <Pressable
      {...a11yButton(jobSummary(job))}
      feedback="scale"
      haptic="light"
      onPress={() => onPress(job)}
      style={{ width }}
    >
      <Card padding={spacing[4]} style={{ gap: 0 }}>
        <View style={[styles.topRow, { paddingBottom: spacing[3] }]}>
          <LogoTile name={job.company} logoUrl={job.companyLogoUrl} size={s(44)} />
          {job.matchScore != null ? (
            <StatBadge value={formatPercent(job.matchScore)} label="Match" />
          ) : null}
        </View>
        <Text variant="cardTitle" numberOfLines={1}>
          {job.company}
        </Text>
        <Text variant="bodyMedium" color="textSecondary" numberOfLines={1}>
          {job.title}
        </Text>
        <View style={[styles.chips, { paddingTop: spacing[3], gap: spacing[2] }]}>
          <Chip label={EMPLOYMENT_TYPE_LABEL[job.employmentType]} />
          <Chip label={formatRelativeTime(job.postedAt)} />
        </View>
        <AvatarStack caption={applicantsCopy(job.applicantsCount)} style={{ paddingTop: spacing[3] }} />
      </Card>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
