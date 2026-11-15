'use client';

import { bestFigureLine, type KeywordQuestion, type TailorComparison } from '@nextkin/shared/models';
import { useDraftFigure } from '@nextkin/shared/queries';
import { allAccepted, statesResult } from '@nextkin/shared/tailor/customize';
import { useState } from 'react';

import { Button } from '@/ui/Button';
import { Stars02 } from '@/ui/lineIcons';

import type { TailorChoices } from '../useTailorRun';

type Bullet = { roleId: string; index: number; text: string };

/** How many lines ask the AI for their result at once. */
const AT_ONCE = 3;

/**
 * "Accept all suggestions" (owner, 2026-11-15; D-25, toreview §211): one press takes everything
 * the AI suggests for this job. Every missing keyword and soft skill is ticked, every "Did you use
 * this?" is answered yes, and each line with no measured result takes the AI's best one. Nothing
 * starts accepted: the candidate presses this, or picks one by one, and can undo any of it after.
 * A line the AI has no result for is left for them to write, and the note says how many.
 */
export function AcceptAll({
  comparison,
  choices,
  questions,
  bullets,
}: {
  comparison: TailorComparison;
  choices: TailorChoices;
  questions: readonly KeywordQuestion[];
  bullets: readonly Bullet[];
}) {
  const { mutateAsync } = useDraftFigure();
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const accepted = allAccepted(choices.choices, comparison, questions);
  const open = bullets.filter((b) => choices.figureOf(b.roleId, b.index) === undefined);
  const nothing = comparison.keywords.every((k) => k.onResume) && bullets.length === 0;
  if (nothing) return null;

  const run = async () => {
    setBusy(true);
    const lines: Bullet[] = [];
    const todo = [...open];
    const next = async (): Promise<void> => {
      const bullet = todo.shift();
      if (!bullet) return;
      try {
        const draft = await mutateAsync({
          resumeId: comparison.resumeId,
          roleId: bullet.roleId,
          line: bullet.index,
          text: bullet.text,
        });
        const line = bestFigureLine(draft);
        if (line && statesResult(line)) lines.push({ ...bullet, text: line });
      } catch {
        // No draft for this line: it stays for the candidate to write.
      }
      return next();
    };
    await Promise.all(Array.from({ length: AT_ONCE }, next));
    choices.acceptAll(comparison, { questions, lines });
    setLeft(open.length - lines.length);
    setBusy(false);
  };

  const clear = () => {
    choices.resetKeywords();
    setLeft(null);
  };

  const done = accepted && open.length === (left ?? 0);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border border-border-brand bg-brand-50 px-4 py-3">
      <div className="min-w-0 flex-1 basis-60">
        <p className="text-body-m font-semibold text-text-primary">
          {done ? 'Every suggestion is accepted' : 'Take everything the AI suggests'}
        </p>
        <p aria-live="polite" className="text-body-s font-medium text-text-secondary">
          {done && left
            ? `${left} ${left === 1 ? 'line still needs' : 'lines still need'} a result only you can write. Open “Add real results”.`
            : done
              ? 'Your resume will name every keyword this job asks for. Untick anything you don’t want.'
              : 'Adds every keyword, says yes to each question and fills each line’s result. You can undo any of it.'}
        </p>
      </div>
      {done ? (
        <Button variant="secondary" onClick={clear}>
          Clear my choices
        </Button>
      ) : (
        <Button
          onClick={run}
          loading={busy}
          busyLabel="Accepting…"
          icon={<Stars02 aria-hidden className="size-4" />}
        >
          Accept all suggestions
        </Button>
      )}
    </div>
  );
}
