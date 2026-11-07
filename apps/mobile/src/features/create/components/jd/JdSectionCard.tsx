import type { ReactNode } from 'react';
import { View } from 'react-native';

import { a11yHeader } from '@/lib';
import { scaledSheet } from '@/theme';
import type { LineIconName } from '@/ui/Icon';
import { FlowCard, IconTile } from '@/ui/kit';
import { Text } from '@/ui/Text';

/** Each section's icon, by its heading; anything unlisted takes the info mark. */
const ICON_FOR: Record<string, LineIconName> = {
  'About the role': 'File06',
  Responsibilities: 'CheckCircle',
  Skills: 'Tool02',
  'Experience and qualifications': 'GraduationHat01',
  'Preferred qualifications': 'Star01',
  Benefits: 'Star01',
  Pay: 'CreditCard01',
  'Where you’ll work': 'MarkerPin01',
  'Schedule and conditions': 'Calendar',
  'How to apply': 'Send01',
  'About the company': 'Building02',
};

/**
 * One part of a job description as a card (owner, 2026-11-08 "make the job description better",
 * §180): an icon tile and the section's heading, then its lines. Used by every section of the JD
 * page, whether the posting was read into structured fields or into its own headings.
 */
export function JdSectionCard({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <FlowCard style={styles.card}>
      <View style={styles.head}>
        <IconTile name={ICON_FOR[title] ?? 'InfoCircle'} size={36} />
        <Text {...a11yHeader()} variant="title3" color="ink" style={styles.flex}>
          {title}
        </Text>
      </View>
      <View style={styles.body}>{children}</View>
    </FlowCard>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  card: { padding: u(18), gap: u(14) },
  head: { flexDirection: 'row', alignItems: 'center', gap: u(12) },
  flex: { flex: 1 },
  body: { gap: u(10) },
}));
