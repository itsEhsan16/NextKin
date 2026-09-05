import { useState } from 'react';
import { View } from 'react-native';

import type { ContentEducation, ContentProject, ContentRole } from '@/data/models';
import { pluralize } from '@/lib';
import { useTheme } from '@/theme';
import { Disclosure } from '@/ui/Disclosure';
import { Text } from '@/ui/Text';

import { COLLAPSED_ROLES } from '../editorSections';
import { EntryBullet, ReviewPill } from './ResumeEntryBits';

/**
 * The three dated entry shapes a resume body prints (V2 §7.11). Each is title, subtitle, period,
 * bullets — the order a printed resume uses, so the editor reads like the export it produces.
 */

function EntryHead({
  title,
  subtitle,
  period,
}: {
  title: string;
  subtitle: string;
  period?: string;
}) {
  const { spacing, s } = useTheme();
  return (
    <View style={{ gap: s(2) }}>
      <Text variant="title">{title}</Text>
      <Text variant="rowDescription" color="textSecondary">
        {subtitle}
      </Text>
      {period ? (
        <Text variant="captionSm" color="textTertiary" style={{ marginTop: spacing[1] }}>
          {period}
        </Text>
      ) : null}
    </View>
  );
}

export function RoleEntry({ role }: { role: ContentRole }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing[3] }}>
      <EntryHead title={role.title} subtitle={role.company} period={role.period} />
      {role.needsReview ? <ReviewPill /> : null}
      <View style={{ gap: spacing[3] }}>
        {role.bullets.map((bullet) => (
          <EntryBullet key={bullet} label={bullet} />
        ))}
      </View>
    </View>
  );
}

export function ProjectEntry({ project }: { project: ContentProject }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing[3] }}>
      <View style={{ gap: spacing[1] }}>
        <Text variant="title">{project.name}</Text>
        <Text variant="prose" color="textBody">
          {project.description}
        </Text>
      </View>
      {project.needsReview ? <ReviewPill /> : null}
      <View style={{ gap: spacing[3] }}>
        {project.bullets.map((bullet) => (
          <EntryBullet key={bullet} label={bullet} />
        ))}
      </View>
    </View>
  );
}

export function EducationEntry({ entry }: { entry: ContentEducation }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing[2] }}>
      <EntryHead title={entry.degree} subtitle={entry.institution} period={entry.period} />
      {entry.needsReview ? <ReviewPill /> : null}
    </View>
  );
}

/**
 * Experience, with everything past the first two roles behind the shared disclosure. A full
 * history is eight roles deep and the section below it would otherwise be a screen and a half
 * away; the recent roles are the ones the reader is editing.
 */
export function ExperienceBody({ roles }: { roles: readonly ContentRole[] }) {
  const { spacing } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const head = roles.slice(0, COLLAPSED_ROLES);
  const rest = roles.slice(COLLAPSED_ROLES);

  return (
    <View style={{ gap: spacing[5] }}>
      {head.map((role) => (
        <RoleEntry key={role.id} role={role} />
      ))}

      {rest.length > 0 ? (
        <Disclosure
          mode="inline"
          expanded={expanded}
          onToggle={() => setExpanded((open) => !open)}
          moreLabel={`Show ${pluralize(rest.length, 'more role')}`}
          lessLabel="Show fewer roles"
        >
          <View style={{ gap: spacing[5] }}>
            {rest.map((role) => (
              <RoleEntry key={role.id} role={role} />
            ))}
          </View>
        </Disclosure>
      ) : null}
    </View>
  );
}
