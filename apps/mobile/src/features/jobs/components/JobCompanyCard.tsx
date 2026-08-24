import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';

import type { Job } from '@/data/models';
import { a11yButton, formatJobMeta } from '@/lib';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { LogoTile } from '@/ui/LogoTile';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type JobCompanyCardProps = { job: Job; onPress: (job: Job) => void };

const LOGO = 48;

/** "About <company>" (Figma 1:889) — profile line plus a website link into the company page. */
export function JobCompanyCard({ job, onPress }: JobCompanyCardProps) {
  const { colors, spacing, s } = useTheme();

  return (
    <Pressable
      {...a11yButton(
        // The website is folded in here rather than being its own stop, so the card reads as one
        // thing — hence the visually-present link below is hidden from the tree.
        `${job.company}. ${formatJobMeta([job.companyIndustry, job.companySize, job.companyWebsite])}`,
        'Opens the company profile',
      )}
      feedback="subtle"
      haptic="light"
      onPress={() => onPress(job)}
    >
      <Card shadow="jobCard" padding={19}>
        <View style={[styles.row, { gap: spacing[4] }]}>
          <LogoTile name={job.company} logoUrl={job.companyLogoUrl} size={s(LOGO)} />
          <View style={styles.copy}>
            <Text variant="title">{job.company}</Text>
            <Text variant="jobMeta" color="textSecondary">
              {formatJobMeta([job.companyIndustry, job.companySize])}
            </Text>
            {/* Folded into the card's own label above, so it is not a second focus stop. */}
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.website, { gap: spacing[2] - 2, marginTop: spacing[1] }]}
            >
              <Text variant="captionSemiBold">{job.companyWebsite}</Text>
              <FontAwesome5 name="external-link-alt" size={s(10)} color={colors.textPrimary} solid />
            </View>
          </View>
          <FontAwesome5 name="chevron-right" size={s(13)} color={colors.iconMuted} solid />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1 },
  website: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
