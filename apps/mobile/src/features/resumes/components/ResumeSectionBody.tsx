import { StyleSheet, View } from 'react-native';

import type { ResumeContent, ResumeSectionKey } from '@/data/models';
import { useTheme } from '@/theme';
import { Chip } from '@/ui/Chip';
import { Text } from '@/ui/Text';

import { EducationEntry, ExperienceBody, ProjectEntry } from './ResumeSectionEntries';

export type ResumeSectionBodyProps = {
  content: ResumeContent;
  section: ResumeSectionKey;
};

/** Skills and certifications are lists of plain strings; both print as a wrap of meta chips. */
function ChipWrap({ items }: { items: readonly string[] }) {
  const { spacing } = useTheme();
  return (
    <View style={[styles.wrap, { gap: spacing[2] }]}>
      {items.map((item) => (
        <Chip key={item} label={item} />
      ))}
    </View>
  );
}

/**
 * One section's body, dispatched on its key (V2 §7.11). The editor renders the structured model
 * rather than a rendered file, so each section is drawn from its own fields — nothing here parses
 * or re-formats text.
 *
 * The caller has already decided the section is non-empty (`resumeSectionIsEmpty`) and draws the
 * "Add …" tile itself, so there is no empty branch below.
 */
export function ResumeSectionBody({ content, section }: ResumeSectionBodyProps) {
  const { spacing } = useTheme();

  switch (section) {
    case 'summary':
      return (
        <Text variant="prose" color="textBody">
          {content.summary}
        </Text>
      );

    case 'skills':
      return <ChipWrap items={content.skills} />;

    case 'certifications':
      return <ChipWrap items={content.certifications} />;

    case 'experience':
      return <ExperienceBody roles={content.experience} />;

    case 'projects':
      return (
        <View style={{ gap: spacing[5] }}>
          {content.projects.map((project) => (
            <ProjectEntry key={project.id} project={project} />
          ))}
        </View>
      );

    case 'education':
      return (
        <View style={{ gap: spacing[4] }}>
          {content.education.map((entry) => (
            <EducationEntry key={entry.id} entry={entry} />
          ))}
        </View>
      );
  }
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
