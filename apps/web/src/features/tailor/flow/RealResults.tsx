'use client';

import type { PlanStep } from '@nextkin/shared/scoring/fixPlan';
import { useDraftFigure } from '@nextkin/shared/queries';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';
import { Check, Plus } from '@/ui/lineIcons';
import { textLink } from '@/ui/textLink';

import { CategoryList, categoryRow } from './PlanExtras';
import { ResultDialog } from './ScoreDialogs';

type Bullet = NonNullable<PlanStep['bullet']>;

const linkAction = cn(textLink, 'flex shrink-0 items-center gap-1.5 text-body-m text-text-brand');

/** The lines with no measured result, from the plan's own steps. */
export function resultBullets(steps: readonly PlanStep[]): Bullet[] {
  return steps.flatMap((s) => (s.kind === 'number' && s.bullet ? [s.bullet] : []));
}

/**
 * One line to finish. It asks the AI for its own draft as soon as the list shows (the server keeps
 * each for 30 days), so the row can say what this line is missing ("Add: how many artisans signed
 * up") and the dialog opens on it, instead of the same generic question for every line.
 */
function ResultRow({
  bullet,
  resumeId,
  figure,
  onFigure,
}: {
  bullet: Bullet;
  resumeId: string;
  figure: string | undefined;
  onFigure: (text: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const draftFigure = useDraftFigure();
  const { mutate, isIdle, data: draft } = draftFigure;
  useEffect(() => {
    if (figure !== undefined || !isIdle) return;
    mutate({ resumeId, roleId: bullet.roleId, line: bullet.index, text: bullet.text });
  }, [figure, isIdle, mutate, resumeId, bullet]);
  // The rules' fallback asks the same thing of every line, so only the model's own question shows.
  const asks = draft?.by === 'model' ? draft.hint : undefined;
  return (
    <li className={categoryRow}>
      <div className="min-w-0 flex-1 basis-60">
        <p className="text-body-m text-text-secondary">
          {figure ? (
            <span className="flex items-start gap-2 text-text-primary">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success-600" />
              {figure}
            </span>
          ) : (
            bullet.text
          )}
        </p>
        {!figure && asks && (
          <p className="mt-1 animate-reveal text-body-s font-medium text-text-brand">
            Missing: {asks}
          </p>
        )}
      </div>
      <button type="button" onClick={() => setOpen(true)} className={linkAction}>
        {!figure && <Plus aria-hidden className="size-4" />}
        {figure ? 'Edit your result' : 'Add the result'}
      </button>
      <ResultDialog
        open={open}
        onOpenChange={setOpen}
        resumeId={resumeId}
        bullet={bullet}
        saved={figure}
        draft={draft}
        onSave={onFigure}
      />
    </li>
  );
}

/**
 * "Add real results" (owner, 2026-11-02, toreview §149): the lines with no measured result, each
 * finished in a dialog fitted to that line (owner, 2026-11-14).
 */
export function RealResults({
  steps,
  resumeId,
  figureOf,
  onFigure,
}: {
  steps: readonly PlanStep[];
  resumeId: string;
  figureOf: (bullet: Bullet) => string | undefined;
  onFigure: (bullet: Bullet, text: string | null) => void;
}) {
  const bullets = resultBullets(steps);
  if (bullets.length === 0) return null;
  return (
    <CategoryList
      title="Add real results"
      hint="Lines that say what you did but not what came of it"
      label="Lines to add a result to"
    >
      {bullets.map((bullet) => (
        <ResultRow
          key={`${bullet.roleId}:${bullet.index}`}
          bullet={bullet}
          resumeId={resumeId}
          figure={figureOf(bullet)}
          onFigure={(text) => onFigure(bullet, text)}
        />
      ))}
    </CategoryList>
  );
}
