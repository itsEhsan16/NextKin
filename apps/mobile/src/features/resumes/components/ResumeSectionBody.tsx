import { StyleSheet, View } from 'react-native';

import type { ResumeContent, ResumeSectionKey } from '@/data/models';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

import { EducationList, ExperienceBody, ProjectList } from './ResumeSectionEntries';
import { SourceLine } from './SourceLine';

export type ResumeSectionBodyProps = {
  content: ResumeContent;
  section: ResumeSectionKey;
};

// The skill pills at 390 (RESUMES 06 577:7040), in artboard units.
const PILL_GAP = 6 / 0.75;
const PILL_PAD_X = 10 / 0.75;
const PILL_PAD_Y = 4 / 0.75;

/** Skills and certifications are lists of plain strings; both print as a wrap of grey pills. */
function ChipWrap({ items }: { items: readonly string[] }) {
  const { colors, radii, s } = useTheme();
  return (
    <View style={[styles.wrap, { gap: s(PILL_GAP) }]}>
      {items.map((item) => (
        <SourceLine key={item} text={item}>
          <View
            style={{
              paddingHorizontal: s(PILL_PAD_X),
              paddingVertical: s(PILL_PAD_Y),
              borderRadius: radii.full,
              backgroundColor: colors.surfaceSubtle,
            }}
          >
            <Text variant="micro" color="textBody" numberOfLines={1}>
              {item}
            </Text>
          </View>
        </SourceLine>
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
  switch (section) {
    case 'summary':
      return (
        <SourceLine text={content.summary}>
          <Text variant="body" color="textBody">
            {content.summary}
          </Text>
        </SourceLine>
      );

    case 'skills':
      return <ChipWrap items={content.skills} />;

    case 'certifications':
      return <ChipWrap items={content.certifications} />;

    case 'experience':
      return <ExperienceBody roles={content.experience} />;

    case 'projects':
      return <ProjectList projects={content.projects} />;

    case 'education':
      return <EducationList entries={content.education} />;
  }
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
