import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { JdStructured } from '@/data/models';
import {
  APPLICATION_LABEL,
  ELIGIBILITY_LABEL,
  LEVEL_LABEL,
  SKILL_GROUPS,
  payText,
} from '@/data/models/jd';
import { JobBullet } from '@/features/jobs/components/JobAboutSection';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Chip } from '@/ui/Chip';
import { Text } from '@/ui/Text';

const PAY_PART: Record<string, string> = {
  base: 'Base',
  fixed: 'Fixed',
  variable: 'Variable',
  incentive: 'Incentive',
  bonus: 'Bonus',
  total: 'Total / earning potential',
  unknown: 'Stated as',
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing[3] }}>
      <Text {...a11yHeader()} variant="section">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Bullets({ items }: { items: readonly string[] }) {
  return items.map((text, index) => <JobBullet key={`${index}:${text}`} label={text} />);
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing[2] }}>
      <Text variant="captionSemiBold">{label}</Text>
      {children}
    </View>
  );
}

function Chips({ skills }: { skills: readonly string[] }) {
  const { spacing } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.chips, { gap: spacing[2] }]}>
      {skills.map((skill) => (
        <Chip key={skill} label={skill} />
      ))}
    </View>
  );
}

/** "Label · value" lines for short facts ("Closing date · 30 Nov 2026"). */
function Rows({ rows }: { rows: readonly { label: string; value: string }[] }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing[3] }}>
      {rows.map((r, i) => (
        <View key={`${r.label}-${i}`} style={{ gap: spacing[1] }}>
          <Text variant="caption" color="textSecondary">
            {r.label}
          </Text>
          <Text variant="prose" color="textBody" selectable>
            {r.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * A job read into its structure (toreview §154, mobile's side of §153's page), section by section:
 * the work, what it asks for, pay and perks, conditions, how to apply and the company. Each shows
 * only what the job states, once; an empty one draws nothing. Spec-derived from the job page's
 * sections (`JdReadingSections`), with the same type, bullets and chips.
 */
export function JdStructuredSections({ s }: { s: JdStructured }) {
  const { spacing } = useTheme();
  const hard = s.skills.filter((k) => k.category !== 'soft');
  const required = SKILL_GROUPS.map((g) => ({
    ...g,
    skills: hard
      .filter((k) => k.importance === 'required' && k.category === g.category)
      .map((k) => k.value),
  })).filter((g) => g.skills.length > 0);
  const preferred = hard.filter((k) => k.importance === 'preferred').map((k) => k.value);
  const soft = s.skills.filter((k) => k.category === 'soft').map((k) => k.value);
  const groups = [...new Set(s.responsibilities.map((r) => r.group ?? ''))];
  const grouped = groups.length > 1 || (groups[0] ?? '') !== '';
  const experience = s.experience.lines.map((l) => l.value);
  const education = s.education.map((e) =>
    e.importance === 'preferred' ? `${e.value} (preferred)` : e.value,
  );
  const languages = s.languages.map(
    (l) =>
      `${l.value}${l.level ? ` · ${LEVEL_LABEL[l.level]}` : ''}${l.importance === 'preferred' ? ' (preferred)' : ''}`,
  );
  const pay =
    s.compensation.statements.length > 1 || s.compensation.negotiable
      ? [
          ...s.compensation.statements.map((p) => ({
            label: PAY_PART[p.value.component] ?? 'Pay',
            value: `${payText(p.value)} · “${p.quotes[0]?.text ?? ''}”`,
          })),
          ...(s.compensation.negotiable
            ? [{ label: 'Negotiable', value: 'Yes, the job says so' }]
            : []),
        ]
      : [];
  const conditions = [
    ...s.schedule.map((x) => ({
      label: x.kind === 'days' ? 'Working days' : x.kind[0]!.toUpperCase() + x.kind.slice(1),
      value: x.value,
    })),
    ...s.eligibility.map((e) => ({ label: ELIGIBILITY_LABEL[e.kind], value: e.value })),
  ];
  const apply = s.application.map((a) => ({ label: APPLICATION_LABEL[a.kind], value: a.value }));

  return (
    <View style={{ gap: spacing[6] }}>
      {s.summary ? (
        <View style={{ gap: spacing[2] }}>
          <Text variant="prose" color="textBody">
            {s.summary}
          </Text>
          <Text variant="micro" color="textTertiary">
            Summary written by NextKin from the job.
          </Text>
        </View>
      ) : null}
      {s.responsibilities.length > 0 ? (
        <Section title="Responsibilities">
          {grouped ? (
            groups.map((g) => (
              <Group key={g || 'also'} label={g || 'Also'}>
                <Bullets
                  items={s.responsibilities
                    .filter((r) => (r.group ?? '') === g)
                    .map((r) => r.value)}
                />
              </Group>
            ))
          ) : (
            <Bullets items={s.responsibilities.map((r) => r.value)} />
          )}
        </Section>
      ) : null}
      {required.length + preferred.length + soft.length > 0 ? (
        <Section title="Skills">
          {required.map((g) => (
            <Group key={g.category} label={`Required · ${g.label}`}>
              <Chips skills={g.skills} />
            </Group>
          ))}
          {preferred.length > 0 ? (
            <Group label="Nice to have">
              <Chips skills={preferred} />
            </Group>
          ) : null}
          {soft.length > 0 ? (
            <Group label="Ways of working">
              <Chips skills={soft} />
            </Group>
          ) : null}
        </Section>
      ) : null}
      {experience.length + education.length + languages.length > 0 ? (
        <Section title="Experience and qualifications">
          {experience.length > 0 ? (
            <Group label="Experience">
              <Bullets items={experience} />
            </Group>
          ) : null}
          {education.length > 0 ? (
            <Group label="Education">
              <Bullets items={education} />
            </Group>
          ) : null}
          {languages.length > 0 ? (
            <Group label="Languages">
              <Bullets items={languages} />
            </Group>
          ) : null}
        </Section>
      ) : null}
      {pay.length > 0 ? (
        <Section title="Pay">
          <Rows rows={pay} />
        </Section>
      ) : null}
      {s.benefits.length > 0 ? (
        <Section title="Benefits">
          <Bullets items={s.benefits.map((b) => b.value)} />
        </Section>
      ) : null}
      {conditions.length > 0 ? (
        <Section title="Schedule and conditions">
          <Rows rows={conditions} />
        </Section>
      ) : null}
      {apply.length > 0 ? (
        <Section title="How to apply">
          <Rows rows={apply} />
        </Section>
      ) : null}
      {s.company.about.length > 0 ? (
        <Section title="About the company">
          <Bullets items={s.company.about.map((a) => a.value)} />
        </Section>
      ) : null}
      {s.extras.length > 0 ? (
        <Section title="More from the job">
          <Bullets items={s.extras.map((x) => x.value)} />
        </Section>
      ) : null}
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
}));
