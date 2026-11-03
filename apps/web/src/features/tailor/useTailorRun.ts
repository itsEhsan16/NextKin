import type { TailorComparison, TailorExperienceDepth, TailorFix } from '@nextkin/shared/models';
import { useStartGeneration } from '@nextkin/shared/queries';
import {
  figureKey,
  initialChoices,
  setFigure,
  setFix,
  setPlace,
  tailorRunInput,
  tickKeyword,
  toggleAll,
  togglePlace,
  type CustomizeChoices,
  type KeywordPlace,
} from '@nextkin/shared/tailor/customize';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { showToast } from '@/lib/toast';

import { tailorPath, type TailorTargetRef } from './tailorTarget';

export type { KeywordPlace };

/**
 * The Customize screen's choices (toreview §114): the shared state both apps keep, every part on,
 * the whole history, nothing tapped until the user says.
 */
export function useTailorChoices() {
  const [choices, setChoices] = useState<CustomizeChoices>(initialChoices);
  return {
    choices,
    fixes: new Set(choices.fixes) as ReadonlySet<TailorFix>,
    experience: choices.experience,
    added: choices.added,
    places: choices.places,
    toggleFix: (fix: TailorFix, on: boolean) => setChoices((c) => setFix(c, fix, on)),
    setExperience: (experience: TailorExperienceDepth) => setChoices((c) => ({ ...c, experience })),
    setAdded: (added: string[]) =>
      setChoices((c) => ({
        ...c,
        added,
        places: Object.fromEntries(
          Object.entries(c.places).filter(([label]) => added.includes(label)),
        ),
      })),
    /**
     * A keyword ticked or unticked, taking the places the comparison picked for it (toreview §163);
     * with none it is a skills-list tick only.
     */
    tick: (keyword: string, on: boolean, picks?: TailorComparison['picks']) =>
      setChoices((c) => tickKeyword(c, keyword, on, picks)),
    /** "Select all" over these keywords, each with its picks; again, "Clear". */
    tickAll: (keywords: readonly string[], picks?: TailorComparison['picks']) =>
      setChoices((c) => toggleAll(c, keywords, picks)),
    /** One place switched on or off for a keyword (it ticks it); the set is the user's from then. */
    togglePlace: (keyword: string, where: string, on: boolean) =>
      setChoices((c) => togglePlace(c, keyword, where, on)),
    /** Every place cleared: the keyword stays ticked, in Skills only. */
    clearPlaces: (keyword: string) => setChoices((c) => setPlace(c, keyword, null)),
    /** A bullet rewritten with its real result (toreview §129), or back to the original. */
    figureOf: (roleId: string, line: number) => choices.figures?.[figureKey(roleId, line)],
    setFigure: (roleId: string, line: number, text: string | null) =>
      setChoices((c) => setFigure(c, roleId, line, text)),
    /** A new resume picked: its keywords differ, so the taps start again. */
    resetKeywords: () => setChoices((c) => ({ ...c, added: [], places: {}, figures: {} })),
  };
}
export type TailorChoices = ReturnType<typeof useTailorChoices>;

/**
 * "Create my resume": starts the tailor run for what the screen measured and the user chose
 * (`tailorRunInput`, the same payload mobile sends), then opens its progress.
 */
export function useTailorRun(target: TailorTargetRef) {
  const router = useRouter();
  const start = useStartGeneration();
  const create = (comparison: TailorComparison, choices: CustomizeChoices) => {
    if (start.isPending) return;
    start.mutate(
      tailorRunInput(comparison, choices, target.kind === 'job' ? target.id : undefined),
      {
        onSuccess: (generation) =>
          router.replace(tailorPath(target, { run: generation.id, resumeId: comparison.resumeId })),
        onError: () => showToast("We couldn't start tailoring. Try again.", { tone: 'error' }),
      },
    );
  };
  return { create, pending: start.isPending };
}
