import { simulate } from '../mock';
import type { InterviewMark, InterviewSet } from '../models';

import { clone, findOrThrow, type MockStore } from './state';
import type { InterviewRepo } from './types';

/**
 * NextKin V2 spec §7.15 — practice sets, once they exist.
 *
 * Creating one is the generation pipeline's job (`interviewCompletion.ts`), which is why there
 * is no `create` here: every set arrives through `generations.start({ kind: 'interview' })`, so
 * §7.15's "generation runs as an async job like all AI work" holds for both modes and there is
 * one progress screen. What lives here is reading sets back and the marks the reader leaves on
 * them — which persist, because the spec says they must survive the session.
 */
export function createMockInterviewRepo(store: MockStore): InterviewRepo {
  const byCreatedDesc = (a: InterviewSet, b: InterviewSet): number =>
    b.createdAt.localeCompare(a.createdAt);

  const write = (next: InterviewSet): InterviewSet => {
    store.state.interviewSets = store.state.interviewSets.map((set) =>
      set.id === next.id ? next : set,
    );
    return clone(next);
  };

  return {
    list: () =>
      simulate(() => clone([...store.state.interviewSets].sort(byCreatedDesc)), {
        empty: () => [],
      }),

    get: (id) => simulate(() => clone(findOrThrow(store.state.interviewSets, id, 'InterviewSet'))),

    getByGeneration: (generationId) =>
      simulate(
        () => {
          const set = store.state.interviewSets.find((item) => item.generationId === generationId);
          return set ? clone(set) : null;
        },
        { empty: () => null },
      ),

    markQuestion: (setId, questionId, mark: InterviewMark) =>
      simulate(() => {
        const set = findOrThrow(store.state.interviewSets, setId, 'InterviewSet');
        findOrThrow(set.questions, questionId, 'InterviewQuestion');
        return write({
          ...set,
          questions: set.questions.map((question) =>
            question.id === questionId ? { ...question, mark } : question,
          ),
        });
      }),

    resetMarks: (setId) =>
      simulate(() => {
        const set = findOrThrow(store.state.interviewSets, setId, 'InterviewSet');
        return write({
          ...set,
          questions: set.questions.map((question) => ({
            ...question,
            mark: 'unmarked' as const,
          })),
        });
      }),

    remove: (id) =>
      simulate(() => {
        findOrThrow(store.state.interviewSets, id, 'InterviewSet');
        store.state.interviewSets = store.state.interviewSets.filter((set) => set.id !== id);
      }),
  };
}
