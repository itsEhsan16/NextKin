'use client';

import {
  FIGURE_KINDS,
  figureKind,
  pickedLine,
  type FigureKindKey,
} from '@nextkin/shared/tailor/figures';
import { useState } from 'react';

import { Capsule } from '@/features/create/jobFlow/FlowRows';
import { cn } from '@/lib/cn';
import { buttonClass } from '@/ui/Button';

import { TypedFigure } from './TypedFigure';
import { BUTTON_VARIANT } from '@/ui/buttonStyles';

const OTHER = 'other';

type Bullet = { roleId: string; index: number; text: string };

/**
 * "Add the result" by picking (owner, 2026-11-02, toreview §149): what improved, then roughly how
 * much, and the line is built from both. Nothing is picked for the person, and the AI never picks a
 * value. "Something else" opens the typed version for a result the choices don't cover.
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
  bullet: Bullet;
  saved: string | undefined;
  onSave: (text: string | null) => void;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<FigureKindKey | typeof OTHER | null>(null);
  const [size, setSize] = useState<string | null>(null);

  if (kind === OTHER)
    return (
      <TypedFigure
        open={open}
        resumeId={resumeId}
        bullet={bullet}
        saved={saved}
        onSave={onSave}
        onDone={onDone}
      />
    );

  const picked = kind ? figureKind(kind) : undefined;
  const line = pickedLine(bullet.text, kind, size);
  const choose = (next: FigureKindKey | typeof OTHER) => {
    setKind(next === kind ? null : next);
    setSize(null);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-neutral-50 px-4 py-3.5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-body-m font-semibold text-text-primary">What improved?</legend>
        <div className="flex flex-wrap gap-2">
          {FIGURE_KINDS.map((option) => (
            <Capsule
              key={option.key}
              label={option.label}
              state={kind === option.key ? 'on' : 'off'}
              onToggle={() => choose(option.key)}
            />
          ))}
          <Capsule label="Something else" state="off" onToggle={() => choose(OTHER)} />
        </div>
      </fieldset>

      {picked && (
        <fieldset className="flex animate-reveal flex-col gap-2">
          <legend className="mb-2 text-body-m font-semibold text-text-primary">
            By about how much?
          </legend>
          <div className="flex flex-wrap gap-2">
            {picked.sizes.map((option) => (
              <Capsule
                key={option}
                label={option}
                state={size === option ? 'on' : 'off'}
                onToggle={() => setSize(size === option ? null : option)}
              />
            ))}
          </div>
        </fieldset>
      )}

      {line && (
        <p aria-live="polite" className="text-body-m leading-relaxed text-text-secondary">
          <span className="font-semibold text-text-primary">Your line: </span>
          {line}
        </p>
      )}
      <p className="text-body-s font-medium text-text-tertiary">
        Pick only what’s true. Interviewers may ask how you measured it.
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          disabled={!line}
          onClick={() => {
            if (!line) return;
            onSave(line);
            onDone();
          }}
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
            className={cn(
              BUTTON_VARIANT.secondary,
              'h-8 rounded-sm px-3.5 text-body-m font-semibold',
            )}
          >
            Keep the original
          </button>
        )}
      </div>
    </div>
  );
}
