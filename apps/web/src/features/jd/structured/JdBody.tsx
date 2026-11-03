'use client';

import { payText } from '@nextkin/shared/jobs/jdChecks';
import type { JdStructured, Profile } from '@nextkin/shared/models';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { CheckCircle } from '@/ui/lineIcons';
import {
  InsightsStarIllustration,
  JdArtDocumentSearchIllustration,
  ProfileCompanyIllustration,
  ProfileEducationIllustration,
  ProfileGoalsIllustration,
  ProfilePaperPlaneIllustration,
  ProfileSkillsIllustration,
  SettingsBillingIllustration,
  SettingsCalendarIllustration,
} from '@/ui/illustrations';

import { Bullets, JobSection } from '../../jobs/components/page/JobSections';
import { hasSkill } from '../../jobs/jobPageLibrary';
import { APPLICATION_LABEL, ELIGIBILITY_LABEL, LEVEL_LABEL, SKILL_GROUPS } from './jdLabels';

const PAY_PART: Record<string, string> = {
  base: 'Base',
  fixed: 'Fixed',
  variable: 'Variable',
  incentive: 'Incentive',
  bonus: 'Bonus',
  total: 'Total / earning potential',
  unknown: 'Stated as',
};

function Chips({
  label,
  skills,
  profile,
}: {
  label: string;
  skills: readonly string[];
  profile: Profile | undefined;
}) {
  return (
    <div>
      <h3 className="text-body-s font-semibold text-text-primary">
        {label} <span className="font-normal text-text-tertiary">· {skills.length}</span>
      </h3>
      <ul aria-label={label} className="mt-2 flex flex-wrap gap-2">
        {skills.map((skill) => {
          const own = hasSkill(profile, skill);
          return (
            <li
              key={skill}
              className={cn(
                'flex items-center gap-1.5 rounded-sm border px-2 py-1 text-caption-m font-medium',
                own
                  ? 'border-transparent bg-success-surface text-success-text'
                  : 'border-border-default bg-surface-card text-text-secondary',
              )}
            >
              {own && <CheckCircle aria-hidden className="size-4" />}
              {skill}
              {own && <span className="sr-only">(on your profile)</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Label: value rows, for the facts that are short ("Closing date: 30 Nov 2026"). */
function Rows({ rows }: { rows: readonly { label: string; value: ReactNode }[] }) {
  if (rows.length === 0) return null;
  return (
    <dl className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <div
          key={`${r.label}-${i}`}
          className="flex flex-col gap-0.5 text-body-m sm:flex-row sm:gap-3"
        >
          <dt className="shrink-0 text-text-tertiary sm:w-40">{r.label}</dt>
          <dd className="min-w-0 text-text-secondary">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Responsibilities({ s }: { s: JdStructured }) {
  if (s.responsibilities.length === 0) return null;
  const groups = [...new Set(s.responsibilities.map((r) => r.group ?? ''))];
  const grouped = groups.length > 1 || groups[0] !== '';
  return (
    <JobSection id="jd-responsibilities" Art={ProfileGoalsIllustration} title="Responsibilities">
      {grouped ? (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g || 'other'}>
              <h3 className="mb-2 text-body-s font-semibold text-text-primary">{g || 'Also'}</h3>
              <Bullets
                items={s.responsibilities.filter((r) => (r.group ?? '') === g).map((r) => r.value)}
              />
            </div>
          ))}
        </div>
      ) : (
        <Bullets items={s.responsibilities.map((r) => r.value)} />
      )}
    </JobSection>
  );
}

function Skills({ s, profile }: { s: JdStructured; profile: Profile | undefined }) {
  const hard = s.skills.filter((k) => k.category !== 'soft');
  const required = SKILL_GROUPS.map((g) => ({
    ...g,
    skills: hard
      .filter((k) => k.importance === 'required' && k.category === g.category)
      .map((k) => k.value),
  })).filter((g) => g.skills.length > 0);
  const preferred = hard.filter((k) => k.importance === 'preferred').map((k) => k.value);
  const soft = s.skills.filter((k) => k.category === 'soft').map((k) => k.value);
  if (required.length === 0 && preferred.length === 0 && soft.length === 0) return null;
  return (
    <JobSection
      id="jd-skills"
      Art={ProfileSkillsIllustration}
      title="Skills"
      aside={
        profile ? (
          <span className="flex items-center gap-1.5 text-body-s text-text-tertiary">
            <CheckCircle aria-hidden className="size-4.5 text-success-600" />
            Already on your profile
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        {required.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-body-m font-semibold text-text-primary">Required</p>
            {required.map((g) => (
              <Chips key={g.category} label={g.label} skills={g.skills} profile={profile} />
            ))}
          </div>
        )}
        {preferred.length > 0 && (
          <Chips label="Nice to have" skills={preferred} profile={profile} />
        )}
        {soft.length > 0 && <Chips label="Ways of working" skills={soft} profile={profile} />}
      </div>
    </JobSection>
  );
}

function Qualifications({ s }: { s: JdStructured }) {
  const experience = s.experience.lines.map((l) => l.value);
  const education = s.education.map((e) =>
    e.importance === 'preferred' ? `${e.value} (preferred)` : e.value,
  );
  const languages = s.languages.map(
    (l) =>
      `${l.value}${l.level ? ` · ${LEVEL_LABEL[l.level]}` : ''}${l.importance === 'preferred' ? ' (preferred)' : ''}`,
  );
  if (!experience.length && !education.length && !languages.length) return null;
  return (
    <JobSection
      id="jd-qualifications"
      Art={ProfileEducationIllustration}
      title="Experience and qualifications"
    >
      <div className="flex flex-col gap-4">
        {experience.length > 0 && <Labelled title="Experience" items={experience} />}
        {education.length > 0 && <Labelled title="Education" items={education} />}
        {languages.length > 0 && <Labelled title="Languages" items={languages} />}
      </div>
    </JobSection>
  );
}

function Labelled({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-body-s font-semibold text-text-primary">{title}</h3>
      <Bullets items={items} />
    </div>
  );
}

/** Pay in full only when there is more to say than the quick facts: several lines, or negotiable. */
function Pay({ s }: { s: JdStructured }) {
  const { statements, negotiable } = s.compensation;
  if (statements.length < 2 && !negotiable) return null;
  return (
    <JobSection id="jd-pay" Art={SettingsBillingIllustration} title="Pay">
      <Rows
        rows={[
          ...statements.map((p) => ({
            label: PAY_PART[p.value.component] ?? 'Pay',
            value: `${payText(p.value)} · “${p.quotes[0]?.text ?? ''}”`,
          })),
          ...(negotiable ? [{ label: 'Negotiable', value: 'Yes, the listing says so' }] : []),
        ]}
      />
    </JobSection>
  );
}

function Simple({
  id,
  title,
  Art,
  items,
}: {
  id: string;
  title: string;
  Art: typeof InsightsStarIllustration;
  items: readonly string[];
}) {
  if (items.length === 0) return null;
  return (
    <JobSection id={id} Art={Art} title={title}>
      <Bullets items={items} />
    </JobSection>
  );
}

/**
 * A job read into its structure (toreview §153), section by section: what the work is, what it
 * asks for, what it pays and offers, the conditions, how to apply and the company. Each section
 * shows only what the posting states, once; an empty one is left out.
 */
export function JdBody({ s, profile }: { s: JdStructured; profile: Profile | undefined }) {
  const conditions = [
    ...s.schedule.map((x) => ({
      label: x.kind === 'days' ? 'Working days' : x.kind[0]!.toUpperCase() + x.kind.slice(1),
      value: x.value,
    })),
    ...s.eligibility.map((e) => ({ label: ELIGIBILITY_LABEL[e.kind], value: e.value })),
  ];
  const apply = s.application.map((a) => ({ label: APPLICATION_LABEL[a.kind], value: a.value }));
  return (
    <>
      {s.summary && (
        <section aria-labelledby="jd-summary" className="px-8 pb-2 pt-1">
          <h2 id="jd-summary" className="sr-only">
            Summary
          </h2>
          <p className="text-body-m text-text-secondary">{s.summary}</p>
          <p className="mt-1.5 text-caption-m text-text-tertiary">
            Summary written by NextKin from the listing.
          </p>
        </section>
      )}
      <Responsibilities s={s} />
      <Skills s={s} profile={profile} />
      <Qualifications s={s} />
      <Pay s={s} />
      <Simple
        id="jd-benefits"
        title="Benefits"
        Art={InsightsStarIllustration}
        items={s.benefits.map((b) => b.value)}
      />
      {conditions.length > 0 && (
        <JobSection
          id="jd-conditions"
          Art={SettingsCalendarIllustration}
          title="Schedule and conditions"
        >
          <Rows rows={conditions} />
        </JobSection>
      )}
      {apply.length > 0 && (
        <JobSection id="jd-apply" Art={ProfilePaperPlaneIllustration} title="How to apply">
          <Rows rows={apply} />
        </JobSection>
      )}
      <Simple
        id="jd-company"
        title="About the company"
        Art={ProfileCompanyIllustration}
        items={s.company.about.map((a) => a.value)}
      />
      <Simple
        id="jd-extras"
        title="More from the listing"
        Art={JdArtDocumentSearchIllustration}
        items={s.extras.map((x) => x.value)}
      />
    </>
  );
}
