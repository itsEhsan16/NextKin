'use client';

import type { PlanStep } from '@nextkin/shared/scoring/fixPlan';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { CollapseFade } from '@/ui/CollapseFade';
import { ChevronDownIcon } from '@/ui/icons';
import { Check } from '@/ui/lineIcons';
import { textLink } from '@/ui/textLink';

import { FigureEditor } from './FigureEditor';

type Bullet = NonNullable<PlanStep['bullet']>;

const SHOWN = 3;
const linkAction = cn(textLink, 'flex items-center gap-1.5 text-body-m text-text-brand');

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
  const [editing, setEditing] = useState(false);
  return (
    <li className="flex flex-col gap-2 rounded-lg bg-neutral-50 px-4 py-3">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <p className="min-w-0 flex-1 text-body-m text-text-secondary">
          {figure ? (
            <span className="flex items-start gap-2 text-text-primary">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success-600" />
              {figure}
            </span>
          ) : (
            bullet.text
          )}
        </p>
        <button
          type="button"
          aria-expanded={editing}
          onClick={() => setEditing((v) => !v)}
          className={linkAction}
        >
          {figure ? 'Edit your result' : 'Add the result'}
          <ChevronDownIcon
            aria-hidden
            className={cn(
              'size-3 transition-transform duration-press ease-standard',
              editing && 'rotate-180',
            )}
          />
        </button>
      </div>
      <CollapseFade axis="vertical" open={editing}>
        <FigureEditor
          open={editing}
          resumeId={resumeId}
          bullet={bullet}
          saved={figure}
          onSave={onFigure}
          onDone={() => setEditing(false)}
        />
      </CollapseFade>
    </li>
  );
}

/**
 * "Add real results" (owner, 2026-11-02, toreview §149): the lines with no measured result, from the
 * plan's own steps, each finished by two picks. The rest of the plan sits beside it (toreview §161).
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
  const [all, setAll] = useState(false);
  const bullets = steps.flatMap((s) => (s.kind === 'number' && s.bullet ? [s.bullet] : []));
  if (bullets.length === 0) return null;
  const shown = all ? bullets : bullets.slice(0, SHOWN);
  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex flex-wrap items-baseline gap-2">
        <span className="text-body-l font-bold text-text-primary">Add real results</span>
        <span className="text-body-s font-medium text-text-tertiary">
          Lines that say what you did but not what came of it
        </span>
      </p>
      <ul className="flex flex-col gap-2">
        {shown.map((bullet) => (
          <ResultRow
            key={`${bullet.roleId}:${bullet.index}`}
            bullet={bullet}
            resumeId={resumeId}
            figure={figureOf(bullet)}
            onFigure={(text) => onFigure(bullet, text)}
          />
        ))}
      </ul>
      {bullets.length > SHOWN && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className={cn(linkAction, 'self-start')}
        >
          {all ? 'Show fewer' : `Show ${bullets.length - SHOWN} more`}
        </button>
      )}
    </div>
  );
}
