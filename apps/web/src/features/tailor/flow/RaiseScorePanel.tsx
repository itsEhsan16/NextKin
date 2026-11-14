'use client';

import type { TailorComparison } from '@nextkin/shared/models';
import { keywordRowsOf } from '@nextkin/shared/tailor/keywordRows';
import { useMemo, useState } from 'react';

import { AlertCircle, Briefcase01, Edit05, Plus, User01, Zap } from '@/ui/lineIcons';

import type { TailorChoices } from '../useTailorRun';
import { HeaderChecks } from './HeaderChecks';
import { KeywordPanel } from './KeywordPanel';
import { MoreFixes, ShowInRole, moreFixItems, showInRoleItems } from './PlanExtras';
import { RealResults, resultBullets } from './RealResults';
import { ScoreRail, type RailItem } from './ScoreRail';

type Category = 'missing' | 'optional' | 'roles' | 'results' | 'header' | 'fixes';

/**
 * Every way to raise the score in one place (owner, 2026-11-14: "categorized intelligently …
 * all things are in upper part only"): the keywords the resume lacks, the skills to show in a
 * role, the lines to finish with a result, the header lines to check, and the rest of the plan.
 * The rail says how many each holds and how many are answered; the open one's list sits beside
 * it. Answers that need typing or picking open in a dialog. A category with nothing in it is left
 * out, except the two keyword lists, which say so.
 */
export function RaiseScorePanel({
  comparison,
  choices,
}: {
  comparison: TailorComparison;
  choices: TailorChoices;
}) {
  const steps = comparison.plan?.steps ?? [];
  const places = comparison.places ?? [];
  const rows = useMemo(() => keywordRowsOf(comparison), [comparison]);
  const roles = showInRoleItems(steps, places);
  const bullets = resultBullets(steps);
  const checks = comparison.headerChecks ?? [];
  const fixes = moreFixItems(steps);

  const inTab = (tab: 'missing' | 'optional') => rows.filter((r) => r.tab === tab);
  const tickedIn = (tab: 'missing' | 'optional') =>
    inTab(tab).filter((r) => choices.added.includes(r.label)).length;

  const all: RailItem<Category>[] = [
    {
      id: 'missing',
      label: 'Missing keywords',
      count: inTab('missing').length,
      answered: tickedIn('missing'),
      icon: AlertCircle,
    },
    {
      id: 'optional',
      label: 'Optional keywords',
      count: inTab('optional').length,
      answered: tickedIn('optional'),
      icon: Plus,
    },
    {
      id: 'roles',
      label: 'Show in a role',
      count: roles.length,
      answered: roles.filter((s) => (choices.places[s.keyword]?.where.length ?? 0) > 0).length,
      icon: Briefcase01,
    },
    {
      id: 'results',
      label: 'Add real results',
      count: bullets.length,
      answered: bullets.filter((b) => choices.figureOf(b.roleId, b.index) !== undefined).length,
      icon: Zap,
    },
    {
      id: 'header',
      label: 'Check your header',
      count: checks.length,
      answered: checks.filter((c) => choices.headerChoiceOf(c.index) != null).length,
      icon: User01,
    },
    { id: 'fixes', label: 'Other fixes', count: fixes.length, icon: Edit05 },
  ];
  const items = all.filter((i) => i.count > 0 || i.id === 'missing' || i.id === 'optional');

  const [picked, setPicked] = useState<Category>(
    inTab('missing').length > 0 || rows.length === 0 ? 'missing' : 'optional',
  );
  const open = items.some((i) => i.id === picked) ? picked : 'missing';

  return (
    <div className="grid gap-4 @2xl/main:grid-cols-[15rem_minmax(0,1fr)]">
      <ScoreRail
        title="Ways to raise your score"
        items={items}
        active={open}
        onChange={setPicked}
      />
      <div key={open} className="flex min-w-0 animate-reveal flex-col gap-3">
        {(open === 'missing' || open === 'optional') && (
          <KeywordPanel comparison={comparison} choices={choices} tab={open} />
        )}
        {open === 'roles' && (
          <ShowInRole steps={steps} places={places} picks={comparison.picks} choices={choices} />
        )}
        {open === 'results' && (
          <RealResults
            steps={steps}
            resumeId={comparison.resumeId}
            figureOf={(b) => choices.figureOf(b.roleId, b.index)}
            onFigure={(b, text) => choices.setFigure(b.roleId, b.index, text)}
          />
        )}
        {open === 'header' && <HeaderChecks checks={checks} choices={choices} />}
        {open === 'fixes' && <MoreFixes steps={steps} resumeId={comparison.resumeId} />}
      </div>
    </div>
  );
}
