import { View } from 'react-native';

import { REMOTE_TYPE_LABEL } from '@/data/models';
import type { JdReading, JdSectionKind } from '@/data/models/jd';
import { JobBullet } from '@/features/jobs/components/JobAboutSection';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pill } from '@/ui/Pill';
import { Text } from '@/ui/Text';

const TITLE: Partial<Record<JdSectionKind, string>> = {
  responsibilities: 'Responsibilities',
  preferred: 'Preferred qualifications',
  benefits: 'Benefits',
  compensation: 'Pay',
  location: 'Where you’ll work',
  about_company: 'About the company',
  how_to_apply: 'How to apply',
  other: 'More from the posting',
};

/** The order the page shows them in, after what the job asks for and the role itself. */
const ORDER: readonly JdSectionKind[] = [
  'preferred',
  'benefits',
  'compensation',
  'location',
  'about_company',
  'how_to_apply',
  'other',
];

export type JdReadingSectionsProps = {
  reading: JdReading;
  /** The reading's own duties, when the extraction found none. */
  withResponsibilities: boolean;
};

/**
 * The rest of the posting, section by section, as the job wrote it (toreview §129): what it would
 * like, its benefits, pay, where the work is, the company and how to apply. Each kind once, its
 * lines in the job's order. Pay and the work arrangement are read by code from the text, never
 * guessed, so each shows only when it was found.
 */
export function JdReadingSections({ reading, withResponsibilities }: JdReadingSectionsProps) {
  const { spacing } = useTheme();
  const styles = useStyles();
  const kinds = withResponsibilities ? ['responsibilities' as const, ...ORDER] : ORDER;

  return kinds.map((kind) => {
    const title = TITLE[kind];
    const parts = reading.sections.filter((section) => section.kind === kind);
    const paragraphs = parts.flatMap((section) => section.paragraphs);
    const items = parts.flatMap((section) => section.items);
    const arrangement = kind === 'location' ? reading.workArrangement : undefined;
    const fact =
      kind === 'compensation'
        ? reading.salary
        : arrangement
          ? REMOTE_TYPE_LABEL[arrangement]
          : undefined;
    if (!title || (paragraphs.length === 0 && items.length === 0 && !fact)) return null;

    return (
      <View key={kind} style={{ gap: spacing[3] }}>
        <Text {...a11yHeader()} variant="section">
          {title}
        </Text>
        {fact ? <Pill label={fact} style={styles.fact} /> : null}
        {paragraphs.map((text, index) => (
          <Text key={`${index}:${text}`} variant="prose" color="textBody">
            {text}
          </Text>
        ))}
        {items.map((text, index) => (
          <JobBullet key={`${index}:${text}`} label={text} />
        ))}
      </View>
    );
  });
}

const useStyles = scaledSheet(() => ({
  fact: { alignSelf: 'flex-start' },
}));
