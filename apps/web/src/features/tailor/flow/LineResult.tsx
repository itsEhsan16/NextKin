'use client';

import { figureLine, type FigureDraft } from '@nextkin/shared/models';
import { useDraftFigure } from '@nextkin/shared/queries';
import { statesResult } from '@nextkin/shared/tailor/customize';
import { useEffect, useState } from 'react';

import { Capsule } from '@/features/create/jobFlow/FlowRows';
import { cn } from '@/lib/cn';
import { buttonClass } from '@/ui/Button';
import { AlertCircle, Check, Stars02 } from '@/ui/lineIcons';
import { Skeleton } from '@/ui/Skeleton';
import { textLink } from '@/ui/textLink';

const field =
  'rounded-md border border-border-default bg-surface-card text-body-m text-text-primary transition-colors duration-press ease-standard hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

type Bullet = { roleId: string; index: number; text: string };

/**
 * "Add the result", fitted to this one line (owner, 2026-11-14: the generic "Made it faster / Saved
 * money" picks felt ready-made). The AI rewrites the user's own bullet around a gap and says what
 * belongs in it ("how many artisans signed up"); the user types the real figure and watches the
 * line read with it. When the AI has a typical figure it offers it apart, as a guess to tap only if
 * it is close to true (toreview §173). The AI never writes a figure into the line. "Write the
 * whole line myself" edits it freely. Mobile's `PlanFigureEditor` is the same flow.
 */
export function LineResult({
  resumeId,
  bullet,
  saved,
  draft: given,
  onSave,
  onDone,
}: {
  resumeId: string;
  bullet: Bullet;
  saved: string | undefined;
  /** The draft the row already fetched; without one the editor asks for it. */
  draft?: FigureDraft | null | undefined;
  onSave: (text: string | null) => void;
  onDone: () => void;
}) {
  const draftFigure = useDraftFigure();
  const [fetched, setFetched] = useState<FigureDraft | null>(null);
  const [own, setOwn] = useState<string | null>(saved ?? null);
  const [figure, setFigure] = useState('');
  // Which of the AI's results is picked, and whether the amount is being typed.
  const [pick, setPick] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);
  const draft = given ?? fetched;
  const options = draft?.options ?? [];
  const chosen = pick !== null ? options[pick] : undefined;
  // The wording the figure goes into: the picked result's, else the plain draft's.
  const shape = chosen ?? draft;

  const { mutate, isIdle } = draftFigure;
  useEffect(() => {
    if (own !== null || given || !isIdle) return;
    mutate(
      { resumeId, roleId: bullet.roleId, line: bullet.index, text: bullet.text },
      { onSuccess: setFetched, onError: () => setOwn(bullet.text) },
    );
  }, [own, given, isIdle, mutate, resumeId, bullet]);

  const line = own ?? (shape && figure.trim() ? figureLine(shape, figure) : '');
  const counts = line !== '' && statesResult(line) && line.trim() !== bullet.text.trim();
  const suggestion = draft?.suggestion;
  const choose = (index: number) => {
    setPick(index === pick ? null : index);
    setFigure('');
    setTyping(false);
  };
  const save = () => {
    onSave(line.trim());
    onDone();
  };

  return (
    <div className="flex flex-col gap-4">
      {own !== null ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-body-m font-semibold text-text-primary">
            Your line, with its real result
          </span>
          <textarea
            value={own}
            onChange={(e) => setOwn(e.target.value)}
            rows={3}
            maxLength={300}
            autoFocus
            className={cn(field, 'w-full resize-none px-3 py-2')}
          />
          {draftFigure.isError && (
            <span className="text-body-s text-text-tertiary">
              The AI couldn’t fit a result into this line, so write it as you like.
            </span>
          )}
        </label>
      ) : !draft ? (
        <div role="status" className="flex flex-col gap-2">
          <span className="text-body-m font-semibold text-text-primary">
            Fitting a result into this line…
          </span>
          <Skeleton className="h-5 w-full rounded-sm" />
          <Skeleton className="h-5 w-2/3 rounded-sm" />
        </div>
      ) : (
        <div className="flex animate-reveal flex-col gap-4">
          {/* The line as it will read, the gap filled live. */}
          <p
            aria-live="polite"
            className="rounded-lg border-l-4 border-border-brand-strong bg-neutral-50 px-4 py-3 text-body-m leading-relaxed text-text-primary"
          >
            {shape!.before}{' '}
            <span
              className={cn(
                'rounded-sm px-1 font-semibold',
                figure.trim() ? 'bg-brand-50 text-text-brand' : 'bg-warning-50 text-warning-text',
              )}
            >
              {figure.trim() || (chosen ? chosen.what.toLowerCase() : draft.hint)}
            </span>
            {shape!.after}
          </p>

          {options.length > 0 ? (
            <>
              {/* The AI's own results for this line, then its amounts: pick, don't type
                  (owner, 2026-11-14). Nothing is picked for the user. */}
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-body-m font-semibold text-text-primary">
                  What came of it?
                </legend>
                <div className="flex flex-wrap gap-2">
                  {options.map((option, index) => (
                    <Capsule
                      key={option.what}
                      label={option.what}
                      state={pick === index ? 'on' : 'off'}
                      onToggle={() => choose(index)}
                    />
                  ))}
                </div>
              </fieldset>
              {chosen && (
                <fieldset className="flex animate-reveal flex-col gap-2">
                  <legend className="mb-2 text-body-m font-semibold text-text-primary">
                    About how much?
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {chosen.amounts.map((amount) => (
                      <Capsule
                        key={amount}
                        label={amount}
                        state={!typing && figure === amount ? 'on' : 'off'}
                        onToggle={() => {
                          setTyping(false);
                          setFigure(figure === amount ? '' : amount);
                        }}
                      />
                    ))}
                    <Capsule
                      label="Another amount"
                      state={typing ? 'on' : 'off'}
                      onToggle={() => {
                        setTyping(!typing);
                        setFigure('');
                      }}
                    />
                  </div>
                  {typing && (
                    <input
                      value={figure}
                      onChange={(e) => setFigure(e.target.value)}
                      maxLength={40}
                      autoFocus
                      aria-label={`The amount: ${chosen.what}`}
                      placeholder={chosen.amounts[0]}
                      className={cn(field, 'mt-1 h-control-md px-3')}
                    />
                  )}
                </fieldset>
              )}
            </>
          ) : (
            <>
              {suggestion && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="text-body-s font-medium text-text-secondary">AI guess</span>
                  <button
                    type="button"
                    aria-label={`Use the AI's guess: ${suggestion}`}
                    onClick={() => setFigure(suggestion)}
                    className="flex items-center gap-1.5 rounded-full border border-dashed border-border-brand-strong bg-surface-brand px-3 py-1 text-body-m font-semibold text-text-brand transition-colors duration-fast ease-standard hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                  >
                    <Stars02 aria-hidden className="size-4" />
                    {suggestion}
                  </button>
                  <span className="flex items-center gap-1 text-body-s text-warning-text">
                    <AlertCircle aria-hidden className="size-4" />A guess. Use it only if it’s close
                    to true.
                  </span>
                </div>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="text-body-m font-semibold text-text-primary">
                  Your figure: {draft.hint}
                </span>
                <input
                  value={figure}
                  onChange={(e) => setFigure(e.target.value)}
                  maxLength={40}
                  autoFocus
                  placeholder={draft.hint}
                  className={cn(field, 'h-control-md px-3')}
                />
              </label>
            </>
          )}
        </div>
      )}

      <p
        className={cn(
          'flex items-center gap-1.5 text-body-s font-medium',
          counts ? 'text-success-text' : 'text-text-tertiary',
        )}
      >
        {counts && <Check aria-hidden className="size-4" />}
        {counts
          ? 'Counts as a measured result'
          : 'Only the real number: a count, a %, time or money saved. Interviewers may ask how you measured it.'}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          disabled={!counts}
          onClick={save}
          className={buttonClass({ size: 'md' })}
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
            className={buttonClass({ variant: 'secondary', size: 'md' })}
          >
            Keep the original
          </button>
        )}
        {own === null && draft && (
          <button
            type="button"
            onClick={() => setOwn(bullet.text)}
            className={cn(textLink, 'text-body-m')}
          >
            Write the whole line myself
          </button>
        )}
      </div>
    </div>
  );
}
