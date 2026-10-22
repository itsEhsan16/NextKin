import { Fragment, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import type { ContentEducation, ContentProject, ContentRole } from '@/data/models';
import { EntryTile } from '@/features/profile/components/cards';
import { pluralize } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Disclosure } from '@/ui/Disclosure';
import { Text } from '@/ui/Text';

import { COLLAPSED_ROLES } from '../editorSections';
import { EntryBullet, ReviewPill } from './ResumeEntryBits';

// The entries at 390 (RESUMES 06 577:7101 / 577:7168 / 577:7258), in artboard units.
const ENTRY_GAP = 12 / 0.75;
const HEAD_GAP = 12 / 0.75;
const LINE_GAP = 2 / 0.75;
const PROJECT_LINE_GAP = 3 / 0.75;
const PROJECT_GAP = 10 / 0.75;
const BULLET_GAP = 7 / 0.75;
/** Entry → divider → entry (577:7121). */
const SEPARATION = 14 / 0.75;

/**
 * The three dated entry shapes a resume body prints (V2 §7.11), drawn as RESUMES 06 draws them:
 * a role or school leads with its letter tile, then its title and a "Company · dates" line, then
 * the bullets. The order a printed resume uses, so the editor reads like the export it produces.
 */

function EntryHead({ name, title, meta }: { name: string; title: string; meta: string }) {
  const styles = useStyles();
  return (
    <View style={styles.head}>
      <EntryTile tile={{ kind: 'letter', name }} size="entry" />
      <View style={styles.headText}>
        <Text variant="label">{title}</Text>
        <Text variant="micro" color="textSecondary">
          {meta}
        </Text>
      </View>
    </View>
  );
}

function Bullets({ items }: { items: readonly string[] }) {
  const styles = useStyles();
  if (items.length === 0) return null;
  return (
    <View style={styles.bullets}>
      {items.map((bullet) => (
        <EntryBullet key={bullet} label={bullet} />
      ))}
    </View>
  );
}

/** A divider between entries, with the board's 14 on either side (577:7121). */
function Separated<T extends { id: string }>({
  items,
  render,
}: {
  items: readonly T[];
  render: (item: T) => ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.separated}>
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {index > 0 ? <View style={[styles.rule, { backgroundColor: colors.divider }]} /> : null}
          {render(item)}
        </Fragment>
      ))}
    </View>
  );
}

const period = (where: string, when: string) => [where, when].filter(Boolean).join(' · ');

export function RoleEntry({ role }: { role: ContentRole }) {
  const styles = useStyles();
  return (
    <View style={styles.entry}>
      <EntryHead name={role.company} title={role.title} meta={period(role.company, role.period)} />
      {role.needsReview ? <ReviewPill /> : null}
      <Bullets items={role.bullets} />
    </View>
  );
}

export function ProjectEntry({ project }: { project: ContentProject }) {
  const styles = useStyles();
  return (
    <View style={styles.project}>
      <View style={styles.projectHead}>
        <Text variant="label">{project.name}</Text>
        {project.description ? (
          <Text variant="body" color="textBody">
            {project.description}
          </Text>
        ) : null}
      </View>
      {project.needsReview ? <ReviewPill /> : null}
      <Bullets items={project.bullets} />
    </View>
  );
}

export function EducationEntry({ entry }: { entry: ContentEducation }) {
  const styles = useStyles();
  return (
    <View style={styles.entry}>
      <EntryHead
        name={entry.institution}
        title={entry.degree}
        meta={period(entry.institution, entry.period)}
      />
      {entry.needsReview ? <ReviewPill /> : null}
    </View>
  );
}

export function ProjectList({ projects }: { projects: readonly ContentProject[] }) {
  return <Separated items={projects} render={(project) => <ProjectEntry project={project} />} />;
}

/** Schools stack without dividers (577:7258 → 577:7264). */
export function EducationList({ entries }: { entries: readonly ContentEducation[] }) {
  const styles = useStyles();
  return (
    <View style={styles.separated}>
      {entries.map((entry) => (
        <EducationEntry key={entry.id} entry={entry} />
      ))}
    </View>
  );
}

/**
 * Experience, with everything past the first two roles behind the shared disclosure. A full
 * history is eight roles deep and the section below it would otherwise be a screen and a half
 * away; the recent roles are the ones the reader is editing.
 */
export function ExperienceBody({ roles }: { roles: readonly ContentRole[] }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);

  const head = roles.slice(0, COLLAPSED_ROLES);
  const rest = roles.slice(COLLAPSED_ROLES);

  return (
    <View style={styles.separated}>
      <Separated items={head} render={(role) => <RoleEntry role={role} />} />

      {rest.length > 0 ? (
        <Disclosure
          mode="inline"
          expanded={expanded}
          onToggle={() => setExpanded((open) => !open)}
          moreLabel={`Show ${pluralize(rest.length, 'more role')}`}
          lessLabel="Show fewer roles"
        >
          <View style={styles.separated}>
            {rest.map((role) => (
              <Fragment key={role.id}>
                <View style={[styles.rule, { backgroundColor: colors.divider }]} />
                <RoleEntry role={role} />
              </Fragment>
            ))}
          </View>
        </Disclosure>
      ) : null}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  head: { flexDirection: 'row', alignItems: 'center', gap: s(HEAD_GAP) },
  headText: { flex: 1, gap: s(LINE_GAP) },
  entry: { gap: s(ENTRY_GAP) },
  project: { gap: s(PROJECT_GAP) },
  projectHead: { gap: s(PROJECT_LINE_GAP) },
  bullets: { gap: s(BULLET_GAP) },
  separated: { gap: s(SEPARATION) },
  rule: { height: s(1 / 0.75) },
}));
