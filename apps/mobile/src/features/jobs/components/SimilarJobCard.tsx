import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { REMOTE_TYPE_LABEL, type Job } from '@/data/models';
import { a11yButton, formatJobMeta, formatSalary } from '@/lib';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { LogoTile } from '@/ui/LogoTile';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type SimilarJobCardProps = { job: Job; onPress: (job: Job) => void };

const LOGO = 40;

/** Compact row in the "Similar jobs" rail (Figma 1:902) — smaller than a JobCard, no bookmark. */
export const SimilarJobCard = memo(function SimilarJobCard({
  job,
  onPress,
}: SimilarJobCardProps) {
  const { colors, radii, spacing } = useTheme();
  const meta = formatJobMeta([job.company, job.location, REMOTE_TYPE_LABEL[job.remote]]);
  const salary = job.salary ? formatSalary(job.salary) : undefined;

  return (
    <Pressable
      {...a11yButton(formatJobMeta([job.title, meta, salary]), 'Opens this job')}
      feedback="scale"
      haptic="light"
      onPress={() => onPress(job)}
    >
      <Card radius="card" shadow="jobCard" padding={15}>
        <View style={[styles.row, { gap: spacing[3] }]}>
          <LogoTile
            name={job.company}
            logoUrl={job.companyLogoUrl}
            size={LOGO}
            style={{ borderRadius: radii.md }}
          />
          <View style={styles.copy}>
            <Text variant="titleSm" numberOfLines={1}>
              {job.title}
            </Text>
            <Text variant="microSemiBold" color="textSecondary" numberOfLines={1}>
              {meta}
            </Text>
            {salary ? <Text variant="captionSemiBold">{salary}</Text> : null}
          </View>
          <FontAwesome5 name="chevron-right" size={12} color={colors.iconMuted} solid />
        </View>
      </Card>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1, gap: 2 },
});
