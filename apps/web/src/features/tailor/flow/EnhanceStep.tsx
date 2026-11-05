'use client';

import type { Job, Resume, TailorComparison, TailorFix } from '@nextkin/shared/models';
import { projectedScore } from '@nextkin/shared/tailor/customize';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import { backButton, ColumnHead, FlowFooter, stepCard } from '@/features/create/jobFlow/FlowChrome';
import { Capsule, Check } from '@/features/create/jobFlow/FlowRows';
import { StepHeading } from '@/features/create/jobFlow/FlowChrome';
import { cn } from '@/lib/cn';
import { NEVER_ADDS_SKILLS } from '@/features/create/createLibrary';
import { Button } from '@/ui/Button';
import { textLink } from '@/ui/textLink';
import { Callout } from '@/ui/Callout';
import { ArrowUp, Check as CheckMark, Stars02, iconSize } from '@/ui/lineIcons';
import { CollapseFade } from '@/ui/CollapseFade';
import { ChevronDownIcon } from '@/ui/icons';
import { NavAiAssistantIllustration, ProfileSkillsIllustration } from '@/ui/illustrations';

import type { TailorChoices } from '../useTailorRun';
import { EXPERIENCE_DEPTH_LABEL, FIX_ROWS } from '../tailorLibrary';
import { EnhanceHeader } from './EnhanceHeader';
import { FullPlan } from './FullPlan';
import { HeaderChecks } from './HeaderChecks';
import { PlacePicker } from './PlacePicker';
import { MoreFixes, ShowInRole } from './PlanExtras';
import { RealResults } from './RealResults';

const linkButton = cn(textLink, 'text-body-m');

/** "Aimed at Lead UX Designer", "Your latest 2 roles" (852:298-326): what each part will do. */
function partLine(
  fix: TailorFix,
  job: Job,
  choices: TailorChoices,
  comparison: TailorComparison,
): string {
  if (fix === 'headline') return `Aimed at ${job.title}`;
  if (fix === 'summary') return 'Rewritten for this role';
  if (fix === 'skills')
    return choices.added.length
      ? `The job’s skills first, plus the ${choices.added.length} you ticked`
      : 'The job’s skills first';
  if (fix === 'experience')
    return choices.experience === 'quick' ? 'Your latest 2 roles' : 'Every role';
  if (fix === 'projects') return 'Reworded in this job’s terms';
  const pages = comparison.pageCount;
  return pages && pages > 2 ? `${pages} pages down to 2` : 'Fit to one page, or two with 5+ years';
}

/**
 * W-FLOW 04 (852:2), now the one step after picking a resume (owner, 2026-11-02, toreview §149):
 * the job against the resume with its score, every keyword from the job to tick (and where each
 * goes), skills to show in a role, the lines to finish with a real result and the rest of the plan
 * (toreview §161), and on the right what the AI will change, the projection and the honesty note.
 * Then Create my resume.
 */
export function EnhanceStep({
  job,
  comparison,
  resume,
  onChangeResume,
  choices,
  allowanceNote,
  spent,
  pending,
  backHref,
  onCreate,
}: {
  job: Job;
  comparison: TailorComparison;
  resume: Resume | undefined;
  onChangeResume: () => void;
  choices: TailorChoices;
  allowanceNote: string;
  spent: boolean;
  pending: boolean;
  backHref: Route;
  onCreate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const missing = comparison.keywords.filter((k) => !k.onResume);
  const have = comparison.keywords.filter((k) => k.onResume);
  const hard = missing.filter((k) => k.kind !== 'soft');
  const soft = missing.filter((k) => k.kind === 'soft');
  const labels = missing.map((k) => k.label);
  const allOn = labels.length > 0 && labels.every((l) => choices.added.includes(l));
  // A tick takes the places picked from the resume's own lines (owner, toreview §163); a keyword
  // that fits nowhere is a skills-list tick, with no row below.
  const picks = comparison.picks;
  const toggle = (label: string) => choices.tick(label, !choices.added.includes(label), picks);
  const placed = hard.filter(
    (k) =>
      choices.added.includes(k.label) &&
      ((picks?.[k.label]?.length ?? 0) > 0 || choices.places[k.label] !== undefined),
  );
  const places = comparison.places ?? [];
  const steps = comparison.plan?.steps ?? [];
  const off = FIX_ROWS.filter((row) => !choices.fixes.has(row.key));

  // The AI's own steps, then what the user has answered at its measured gain (toreview §129). A
  // tick counts half until it has a place (850:224).
  const base = comparison.plan?.score;
  const target = comparison.plan?.target;
  const goal = target?.goal;
  const projected = projectedScore(comparison.plan, choices.choices);
  const gain = projected !== undefined && base !== undefined ? projected - base : 0;
  // What the user's own answers add on top of the AI's steps: the ATS card's estimate (§166).
  const withoutAnswers = projectedScore(comparison.plan, {
    ...choices.choices,
    added: [],
    places: {},
    figures: {},
  });
  const answersGain =
    projected !== undefined && withoutAnswers !== undefined ? projected - withoutAnswers : 0;

  const group = (title: string, hint: string | null, items: typeof missing) =>
    items.length > 0 && (
      <div className="flex flex-col gap-2.5">
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="text-body-l font-bold text-text-primary">{title}</span>
          {hint && <span className="text-body-s font-medium text-text-tertiary">{hint}</span>}
        </p>
        <div className="flex flex-wrap gap-2.5">
          {items.map((k) => (
            <Capsule
              key={k.label}
              label={k.label}
              state={choices.added.includes(k.label) ? 'on' : 'off'}
              onToggle={() => toggle(k.label)}
            />
          ))}
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="enhance-step" className={stepCard}>
        <div className="px-8 pb-2 pt-8">
          <StepHeading
            id="enhance-step"
            step={3}
            of={3}
            title="Choose what to add"
            lede="Tick only the keywords you really have. The AI places each one where your experience backs it."
          />
        </div>
        <EnhanceHeader
          job={job}
          resume={resume}
          onChangeResume={onChangeResume}
          score={comparison.score}
          scored={comparison.scored !== false}
          gain={answersGain}
          selected={choices.added.length}
        />
        <div className="grid divide-y divide-border-subtle lg:grid-cols-8 lg:divide-x lg:divide-y-0">
          <div className="flex min-w-0 flex-col gap-4.5 px-8 pb-8 pt-6 lg:col-span-5 lg:pl-8">
            <ColumnHead
              art={<ProfileSkillsIllustration className="h-auto w-11" />}
              title="Every keyword from this job"
              subtitle={`${have.length} of ${comparison.keywords.length} are already on your resume`}
              aside={
                labels.length > 0 ? (
                  <span className="flex gap-3.5">
                    <button
                      type="button"
                      disabled={allOn}
                      onClick={() =>
                        choices.tickAll(
                          labels.filter((l) => !choices.added.includes(l)),
                          picks,
                        )
                      }
                      className={cn(linkButton, 'text-text-brand disabled:text-text-tertiary')}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        choices.setAdded(choices.added.filter((l) => !labels.includes(l)))
                      }
                      className={cn(linkButton, 'text-text-tertiary')}
                    >
                      Clear
                    </button>
                  </span>
                ) : undefined
              }
            />
            {group('Missing from your resume', 'Tick the ones you have', hard)}
            {placed.length > 0 && (
              <div className="flex flex-col rounded-lg bg-neutral-50 pb-3">
                {placed.map((k) => {
                  const place = choices.places[k.label];
                  return (
                    <div key={k.label} className="flex items-center gap-3 pb-1.5 pl-4 pr-3.5 pt-3">
                      <CheckMark aria-hidden className="size-4 shrink-0 text-text-brand" />
                      <span className="min-w-24 flex-1 truncate text-body-l font-semibold text-text-primary">
                        {k.label}
                      </span>
                      <PlacePicker
                        places={places}
                        where={place?.where}
                        by={place?.by}
                        onToggle={(where, on) => choices.togglePlace(k.label, where, on)}
                        onClear={() => choices.clearPlaces(k.label)}
                      />
                    </div>
                  );
                })}
                <p className="pl-10 pt-1.5 text-body-s font-medium text-text-tertiary">
                  The AI chose where each fits from your own lines. Change any; with none chosen it
                  goes in Skills.
                </p>
              </div>
            )}
            {group('Soft skills', null, soft)}
            <HeaderChecks checks={comparison.headerChecks} choices={choices} />
            <ShowInRole steps={steps} places={places} choices={choices} />
            <MoreFixes steps={steps} resumeId={comparison.resumeId} />
          </div>

          <div className="flex min-w-0 flex-col gap-3.5 px-8 pb-8 pt-6 lg:col-span-3 lg:pr-8">
            <ColumnHead
              art={<NavAiAssistantIllustration className="h-auto w-11" />}
              title="What the AI will change"
              subtitle={
                off.length === 0
                  ? 'All parts are on'
                  : `Leaving as it is: ${off.map((r) => r.label.toLowerCase()).join(', ')}`
              }
            />
            <ul className="flex flex-col gap-0.5 rounded-md bg-neutral-50 p-1.5">
              {FIX_ROWS.map((row) => {
                const on = choices.fixes.has(row.key);
                return (
                  <li key={row.key}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => choices.toggleFix(row.key, !on)}
                      className="flex w-full items-center gap-3 rounded-sm px-3.5 py-2.5 text-left transition-colors duration-fast ease-standard hover:bg-surface-card focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
                    >
                      <Check on={on} />
                      <span className="min-w-0">
                        <span
                          className={cn(
                            'block text-body-l font-semibold',
                            on ? 'text-text-primary' : 'text-text-tertiary',
                          )}
                        >
                          {row.label === 'Work experience' ? 'Experience' : row.label}
                        </span>
                        <span className="block truncate text-body-s font-medium text-text-tertiary">
                          {on ? partLine(row.key, job, choices, comparison) : 'Left as it is'}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              aria-expanded={editing}
              onClick={() => setEditing((v) => !v)}
              className={cn(linkButton, 'flex items-center gap-1.5 self-start text-text-brand')}
            >
              Change what’s included
              <ChevronDownIcon
                aria-hidden
                className={cn(
                  'size-3 transition-transform duration-press ease-standard',
                  editing && 'rotate-180',
                )}
              />
            </button>
            <CollapseFade axis="vertical" open={editing}>
              <fieldset className="flex flex-col gap-2 rounded-lg bg-neutral-50 px-3.5 py-3">
                <legend className="sr-only">How much of your work history to edit</legend>
                {(['quick', 'full'] as const).map((depth) => (
                  <label
                    key={depth}
                    className="flex cursor-pointer items-center gap-2 text-body-m text-text-secondary"
                  >
                    <input
                      type="radio"
                      name="experience-depth"
                      checked={choices.experience === depth}
                      onChange={() => choices.setExperience(depth)}
                      className="size-3.5 accent-brand-600"
                    />
                    {EXPERIENCE_DEPTH_LABEL[depth]}
                  </label>
                ))}
              </fieldset>
            </CollapseFade>
            {projected !== undefined && base !== undefined && gain > 0 && (
              <div
                className="flex items-center gap-2.5 rounded-lg bg-success-surface px-3.5 py-3"
                aria-live="polite"
              >
                <ArrowUp aria-hidden className="size-4.5 shrink-0 text-success-600" />
                <div>
                  <p className="text-body-l font-bold text-success-text">
                    About {projected.toFixed(1)}/10 after this
                    {goal !== undefined && projected >= goal ? ` · ${goal.toFixed(1)} reached` : ''}
                  </p>
                  <p className="text-body-s font-medium text-success-text">
                    Up from {base.toFixed(1)}. Ticks without a place count half.
                    {goal !== undefined && target?.reaches && projected < goal
                      ? ` The rest of the plan reaches ${goal.toFixed(1)}.`
                      : ''}
                  </p>
                </div>
              </div>
            )}
            <Callout>{NEVER_ADDS_SKILLS}</Callout>
          </div>
        </div>
        <FullPlan comparison={comparison} />
      </section>

      <RealResults
        steps={steps}
        resumeId={comparison.resumeId}
        figureOf={(b) => choices.figureOf(b.roleId, b.index)}
        onFigure={(b, text) => choices.setFigure(b.roleId, b.index, text)}
      />

      <FlowFooter note={allowanceNote}>
        <Link href={backHref} className={backButton}>
          Back
        </Link>
        <Button
          size="lg"
          onClick={onCreate}
          disabled={spent || choices.fixes.size === 0}
          loading={pending}
          busyLabel="Starting…"
          icon={<Stars02 aria-hidden className={iconSize.sm} />}
        >
          Create my resume
        </Button>
      </FlowFooter>
    </div>
  );
}
