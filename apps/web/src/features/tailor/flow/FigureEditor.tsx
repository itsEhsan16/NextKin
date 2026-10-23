'use client';

import { figureLine, type FigureDraft } from '@nextkin/shared/models';
import { useDraftFigure } from '@nextkin/shared/queries';
import { statesResult } from '@nextkin/shared/tailor/customize';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';
import { Check } from '@/ui/lineIcons';
import { outlineButton } from '@/ui/outlineButton';
import { buttonClass } from '@/ui/Button';
import { Skeleton } from '@/ui/Skeleton';
import { textLink } from '@/ui/textLink';

const field =
  'rounded-md border border-border-default bg-surface-card text-body-m text-text-primary transition-colors duration-press ease-standard hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

const linkButton = cn(textLink, 'text-body-m');

/**
 * "Add the result" (owner, toreview §129): the AI rewrites the bullet around a gap, and the user
 * types only the real figure into it. The AI never writes the figure; the line counts once it
 * states a measured result (the achievements check itself). "Write it myself" edits the whole line.
 * The draft is asked for the first time the editor opens, not for every row on the page.
 */
export function FigureEditor({
  open,
  resumeId,
  bullet,
  saved,
  onSave,
  onDone,
}: {
  open: boolean;
  resumeId: string;
  bullet: { roleId: string; index: number; text: string };
  saved: string | undefined;
  onSave: (text: string | null) => void;
  onDone: () => void;
}) {
  const draftFigure = useDraftFigure();
  const [draft, setDraft] = useState<FigureDraft | null>(null);
  const [own, setOwn] = useState<string | null>(saved ?? null);
  const [figure, setFigure] = useState('');

  const { mutate, isIdle } = draftFigure;
  useEffect(() => {
    if (!open || own !== null || !isIdle) return;
    mutate(
      { resumeId, roleId: bullet.roleId, line: bullet.index, text: bullet.text },
      { onSuccess: setDraft, onError: () => setOwn(bullet.text) },
    );
  }, [open, own, isIdle, mutate, resumeId, bullet]);

  const line = own ?? (draft && figure.trim() ? figureLine(draft, figure) : '');
  const counts = line !== '' && statesResult(line) && line.trim() !== bullet.text.trim();
  const save = () => {
    onSave(line.trim());
    onDone();
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-lg bg-neutral-50 px-4 py-3.5">
      {own !== null ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-body-m font-semibold text-text-primary">
            Rewrite this line with its real result
          </span>
          <textarea
            value={own}
            onChange={(e) => setOwn(e.target.value)}
            rows={2}
            maxLength={300}
            className={cn(field, 'w-full resize-none px-3 py-2')}
          />
          {draftFigure.isError && (
            <span className="text-body-s text-text-tertiary">
              The AI couldn’t draft this line, so write it as you like.
            </span>
          )}
        </label>
      ) : !draft ? (
        <div role="status" className="flex flex-col gap-2">
          <span className="text-body-m font-semibold text-text-primary">
            The AI is fitting a result into this line…
          </span>
          <Skeleton className="h-5 w-full rounded-sm" />
          <Skeleton className="h-5 w-2/3 rounded-sm" />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 animate-reveal">
          <span className="text-body-m font-semibold text-text-primary">
            Fill in the real result
          </span>
          <p className="text-body-m leading-relaxed text-text-secondary">
            {draft.before}{' '}
            <input
              value={figure}
              onChange={(e) => setFigure(e.target.value)}
              maxLength={40}
              autoFocus
              aria-label={`The result: ${draft.hint}`}
              placeholder={draft.hint}
              className={cn(field, 'mx-0.5 inline-block h-8 w-56 max-w-full px-2.5 align-baseline')}
            />
            {draft.after}
          </p>
        </div>
      )}
      <p
        aria-live="polite"
        className={cn(
          'flex items-center gap-1.5 text-body-s font-medium',
          counts ? 'text-success-text' : 'text-text-tertiary',
        )}
      >
        {counts && <Check aria-hidden className="size-4" />}
        {counts
          ? 'Counts as a measured result'
          : 'Only the real number: a count, a %, time or money saved. Nothing is made up.'}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          disabled={!counts}
          onClick={save}
          className={buttonClass({ size: 'sm' })}
        >
          Use this line
        </button>
        {saved !== undefined && (
          <button
            type="button"
            onClick={() => {
              onSave(null);
              onDone();
            }}
            className={cn(outlineButton, 'h-8 rounded-sm px-3.5 text-body-m font-semibold')}
          >
            Keep the original
          </button>
        )}
        {own === null && (
          <button type="button" onClick={() => setOwn(bullet.text)} className={linkButton}>
            Write it myself
          </button>
        )}
      </div>
    </div>
  );
}
