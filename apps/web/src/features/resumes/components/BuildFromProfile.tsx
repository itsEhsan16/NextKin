'use client';

import type { Profile, ResumeTemplateId, User } from '@nextkin/shared/models';
import { useGeneration, useSetResumeTemplate, useStartGeneration } from '@nextkin/shared/queries';
import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { Radio } from '@/features/create/jobFlow/FlowRows';
import { cn } from '@/lib/cn';
import { fieldBox } from '@/ui/fieldBox';
import { CheckCircle } from '@/ui/lineIcons';
import {
  JdArtDocumentSearchIllustration,
  ProfileAccountIllustration,
  ProfileEducationIllustration,
  ProfileExperienceIllustration,
  ProfileSkillsIllustration,
} from '@/ui/illustrations';
import { ProgressBar } from '@/ui/ProgressBar';

const TEMPLATES: { id: ResumeTemplateId; name: string; line: string }[] = [
  { id: 'jake', name: 'Classic', line: 'Centred name, ruled headings' },
  { id: 'modern', name: 'Modern', line: 'Indigo headings' },
  { id: 'elegant', name: 'Elegant', line: 'Book serif, roomy' },
];

const plural = (n: number, w: string) => `${n} ${n === 1 ? w : `${w}s`}`;

function Row({
  art,
  title,
  line,
  has,
}: {
  art: ReactNode;
  title: string;
  line: string;
  has: boolean;
}) {
  return (
    <li className="flex items-center gap-3 border-t border-border-default px-4 py-2.5">
      <span aria-hidden className="flex w-7 shrink-0 justify-center">
        {art}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body-l font-medium text-text-primary">{title}</span>
        <span className="block truncate text-body-m text-text-tertiary">{line}</span>
      </span>
      {has ? (
        <CheckCircle aria-label="In your profile" className="size-4 shrink-0 text-success-600" />
      ) : (
        <span
          aria-label="Not in your profile"
          className="size-4 shrink-0 rounded-full border-2 border-border-default"
        />
      )}
    </li>
  );
}

/**
 * RES 02 (864:443): build from my profile — the name, what the profile has (each part ticked, or
 * left out when it is empty), and the template. It writes only what the profile states (G13); the
 * template is applied when the run lands, then the editor opens. The dialog's footer starts it.
 */
export function BuildFromProfile({
  profile,
  user,
  onReady,
  footer,
}: {
  profile: Profile;
  user: User | undefined;
  onReady: (resumeId: string) => void;
  /** The dialog's footer, given this panel's note, action and state. */
  footer: (props: {
    note: ReactNode;
    label: string;
    busyLabel: string;
    busy: boolean;
    onAction: () => void;
  }) => ReactNode;
}) {
  const start = useStartGeneration();
  const setTemplate = useSetResumeTemplate();
  const [runId, setRunId] = useState('');
  const [name, setName] = useState(`${profile.headline?.trim() || 'My resume'} — General`);
  const [template, setTpl] = useState<ResumeTemplateId>('jake');
  const nameId = useId();
  const run = useGeneration(runId);
  const status = run.data?.status;
  const working =
    start.isPending ||
    setTemplate.isPending ||
    (runId !== '' && status !== 'ready' && status !== 'failed');
  // The run this panel already opened, so a refetch of a ready run never opens it twice.
  const done = useRef('');

  useEffect(() => {
    const id = run.data?.resumeId;
    if (status !== 'ready' || !id || done.current === runId) return;
    done.current = runId;
    if (template === 'jake') onReady(id);
    else setTemplate.mutate({ id, template }, { onSettled: () => onReady(id) });
  }, [status, run.data?.resumeId, runId, template, onReady, setTemplate]);

  const failed =
    status === 'failed'
      ? (run.data?.error ?? 'The build didn’t finish. Nothing was charged.')
      : start.isError
        ? 'We couldn’t start the build. Try again.'
        : null;
  const go = () => {
    if (working) return;
    setRunId('');
    start.mutate(
      {
        kind: 'resume',
        origin: 'build',
        ...(name.trim() ? { title: name.trim().slice(0, 200) } : {}),
      },
      { onSuccess: (g) => setRunId(g.id) },
    );
  };

  const roles = profile.experiences;
  const school = profile.education[0];
  return (
    <>
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-7 py-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={nameId} className="text-body-m font-semibold text-text-primary">
            Resume name
          </label>
          <input
            id={nameId}
            value={name}
            maxLength={200}
            disabled={working}
            onChange={(e) => setName(e.target.value)}
            className={cn(fieldBox, 'h-control-lg px-3.5 text-body-l')}
          />
        </div>
        {working ? (
          <div
            className="flex flex-col gap-2.5 rounded-lg border border-border-brand-strong bg-surface-brand p-4"
            aria-live="polite"
          >
            <p className="text-body-l font-semibold text-text-primary">
              Writing it from your profile…
            </p>
            <ProgressBar
              value={run.data?.progress ?? 0.05}
              label="Building your resume"
              className="h-2 bg-neutral-100"
            />
            <p className="text-body-m text-text-tertiary">
              About a minute. It opens in the editor when it’s written.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border-default">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-body-l font-bold text-text-primary">What your profile has</h3>
              <Link
                href={'/profile' as Route}
                className="rounded-sm text-body-m font-semibold text-text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Edit profile
              </Link>
            </div>
            <ul>
              <Row
                art={<ProfileAccountIllustration className="h-auto w-6" />}
                title="Contact"
                line={[
                  user ? `${user.firstName} ${user.lastName}` : null,
                  profile.location,
                  profile.phone ? 'email and phone' : 'email',
                ]
                  .filter(Boolean)
                  .join(' · ')}
                has
              />
              <Row
                art={<ProfileExperienceIllustration className="h-auto w-6" />}
                title="Experience"
                line={
                  roles.length
                    ? `${plural(roles.length, 'role')} · ${roles
                        .slice(0, 3)
                        .map((r) => r.company)
                        .join(', ')}`
                    : 'None yet — the section is left out'
                }
                has={roles.length > 0}
              />
              <Row
                art={<ProfileSkillsIllustration className="h-auto w-6" />}
                title="Skills"
                line={
                  profile.skills.length
                    ? plural(profile.skills.length, 'skill')
                    : 'None yet — the section is left out'
                }
                has={profile.skills.length > 0}
              />
              <Row
                art={<ProfileEducationIllustration className="h-auto w-6" />}
                title="Education"
                line={
                  school
                    ? [school.degree, school.institution].filter(Boolean).join(', ') +
                      (school.endDate ? ` · ${school.endDate.slice(0, 4)}` : '')
                    : 'None yet — the section is left out'
                }
                has={!!school}
              />
              <Row
                art={<JdArtDocumentSearchIllustration className="h-auto w-6" />}
                title="Certifications"
                line={
                  profile.certifications.length
                    ? plural(profile.certifications.length, 'certification')
                    : 'None yet — the section is left out'
                }
                has={profile.certifications.length > 0}
              />
            </ul>
          </div>
        )}
        <div role="radiogroup" aria-label="Template" className="flex flex-col gap-2.5">
          <p className="text-body-m font-semibold text-text-primary">Template</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {TEMPLATES.map((t) => {
              const on = t.id === template;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={working}
                  onClick={() => setTpl(t.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors duration-press ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                    on
                      ? 'border-brand-600 bg-surface-brand-strong ring-1 ring-brand-600'
                      : 'border-border-default bg-surface-card hover:border-neutral-400',
                  )}
                >
                  <Radio on={on} />
                  <span className="min-w-0">
                    <span className="block text-body-l font-semibold text-text-primary">
                      {t.name}
                    </span>
                    <span className="block truncate text-body-s text-text-tertiary">{t.line}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {footer({
        note: failed ? (
          <span className="text-danger-600">{failed}</span>
        ) : (
          'Opens in the editor when it’s written.'
        ),
        label: failed ? 'Try again' : 'Create resume',
        busyLabel: 'Writing…',
        busy: working,
        onAction: go,
      })}
    </>
  );
}
