import { StyleSheet, View } from 'react-native';

import type { Job } from '@/data/models';
import { a11yHeader, formatJobMeta } from '@/lib';
import { useTheme } from '@/theme';
import { LogoTile } from '@/ui/LogoTile';
import { Text } from '@/ui/Text';

export type CompanyHeroProps = { job: Job };

/** The company screen leads with a 64pt mark — the largest tile step `LogoTile` draws. */
const LOGO = 64;

/**
 * Who the employer is, in one block: mark, name and the profile line the job detail screen's
 * company card already shows. Spec-derived (V2 §7.13); no artboard exists for this page.
 */
export function CompanyHero({ job }: CompanyHeroProps) {
  const { spacing, s } = useTheme();
  // `formatJobMeta` drops the empty entries and owns the separator, so a company missing either
  // half of its profile reads as one clean line rather than a stranded "·".
  const meta = formatJobMeta([job.companyIndustry, job.companySize]);

  return (
    <View style={[styles.root, { gap: spacing[3] }]}>
      <LogoTile name={job.company} logoUrl={job.companyLogoUrl} size={s(LOGO)} />
      <View style={styles.copy}>
        <Text {...a11yHeader()} variant="pageTitle">
          {job.company}
        </Text>
        {meta ? (
          <Text variant="jobMeta" color="textSecondary" style={{ marginTop: spacing[1] }}>
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1 },
});
