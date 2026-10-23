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

/** Drawn over 0.75: a 36 logo at 10.5 radius, 10.5 from the copy; the link glyph is 7.5. */
const COMPANY = { logo: 48, logoRadius: 14, gap: 14, link: 10, linkGap: 6 };

/**
 * "About <company>" (Figma 443:61, redrawn from 1:889): the name, a one-line tagline for verified
 * companies only, then size and website on one line. The chevron is gone from the board; the
 * card still opens the company page, which is what a tap on it has always done.
 *
 * NOTE: the board fills Stripe's logo tile with Stripe's own purple. Nothing in the data layer
 * carries a company's brand colour, so the tile stays the app's neutral one — see toreview.md.
 */
export function JobCompanyCard({ job, onPress }: JobCompanyCardProps) {
  const { colors, s } = useTheme();
  // The tagline belongs to the badge: an unverified company gets no description line at all.
  const tagline = job.companyVerified ? job.companyTagline : undefined;

  return (
    <Pressable
      {...a11yButton(
        // The website is folded in here rather than being its own stop, so the card reads as one
        // thing — hence the visually-present link below is hidden from the tree.
        `${job.company}. ${formatJobMeta([tagline, job.companySize, job.companyWebsite])}`,
        'Opens the company profile',
      )}
      feedback="subtle"
      haptic="light"
      onPress={() => onPress(job)}
    >
      <Card shadow="jobCard" padding={s(19)}>
        <View style={[styles.row, { gap: s(COMPANY.gap) }]}>
          <LogoTile
            name={job.company}
            logoUrl={job.companyLogoUrl}
            size={s(COMPANY.logo)}
            radius={s(COMPANY.logoRadius)}
          />
          <View style={styles.copy}>
            <Text variant="title" numberOfLines={1}>
              {job.company}
            </Text>
            {tagline ? (
              <Text variant="jobMeta" color="textSecondary" numberOfLines={2}>
                {tagline}
              </Text>
            ) : null}
            {/* Folded into the card's own label above, so it is not a second focus stop. */}
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.meta, { gap: s(COMPANY.linkGap) }]}
            >
              {job.companySize ? (
                <Text variant="caption" color="textSecondary">
                  {`${job.companySize}  ·`}
                </Text>
              ) : null}
              <Text variant="captionSemiBold">{job.companyWebsite}</Text>
              <FontAwesome5
                name="external-link-alt"
                size={s(COMPANY.link)}
                color={colors.textPrimary}
                solid
              />
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  copy: { flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
