'use client';

import type { CoverLetterContent } from '@nextkin/shared/models';
import { useUpdateLetter } from '@nextkin/shared/queries';
import { useEffect, useRef, useState } from 'react';

import type { SaveStatus } from './useAutosave';

/**
 * A cover letter's working copy (toreview §124; EDIT 04): saved 1.2 s after typing stops through
 * the letter route (V2 §7.10), with undo and redo. Typing into one field is one step: changes with
 * the same key inside a second replace the step, so undo takes back a word, not a letter.
 */

export type LetterDraft = Pick<CoverLetterContent, 'greeting' | 'paragraphs' | 'signoff'>;

const SAVE_MS = 1200;
const MERGE_MS = 1000;
const LIMIT = 100;

export function useLetterDraft(id: string, letter: CoverLetterContent | null) {
  const update = useUpdateLetter(id);
  const [draft, setDraft] = useState<LetterDraft | null>(null);
  const [past, setPast] = useState<LetterDraft[]>([]);
  const [future, setFuture] = useState<LetterDraft[]>([]);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef({ key: '', at: 0 });
  const shown: LetterDraft | null =
    draft ??
    (letter
      ? { greeting: letter.greeting, paragraphs: letter.paragraphs, signoff: letter.signoff }
      : null);

  const save = (next: LetterDraft) => {
    if (timer.current) clearTimeout(timer.current);
    setStatus('saving');
    update.mutate(
      { ...next, paragraphs: next.paragraphs.filter((p) => p.trim()) },
      {
        onSuccess: () => {
          setStatus('saved');
          setSavedAt(new Date());
        },
        onError: () => setStatus('failed'),
      },
    );
  };
  const commit = (next: LetterDraft) => {
    setDraft(next);
    setStatus('unsaved');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(next), SAVE_MS);
  };
  const edit = (patch: Partial<LetterDraft>, key: string) => {
    if (!shown) return;
    const now = Date.now();
    const merge = key === last.current.key && now - last.current.at < MERGE_MS;
    last.current = { key, at: now };
    if (!merge) setPast((p) => [...p, shown].slice(-LIMIT));
    setFuture([]);
    commit({ ...shown, ...patch });
  };
  const step = (from: LetterDraft[], to: (d: LetterDraft) => void, drop: () => void) => {
    const target = from.at(-1);
    if (!target || !shown) return;
    to(shown);
    drop();
    last.current = { key: '', at: 0 };
    commit(target);
  };
  const undo = () =>
    step(
      past,
      (d) => setFuture((f) => [...f, d]),
      () => setPast((p) => p.slice(0, -1)),
    );
  const redo = () =>
    step(
      future,
      (d) => setPast((p) => [...p, d]),
      () => setFuture((f) => f.slice(0, -1)),
    );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  useEffect(() => {
    if (status === 'saved') return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

  return {
    shown,
    status,
    savedAt,
    edit,
    save,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
