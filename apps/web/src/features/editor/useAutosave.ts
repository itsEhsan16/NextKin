'use client';

import type { ResumeDocument, ResumeDocumentWrite } from '@nextkin/shared/models';
import { ApiError } from '@nextkin/shared/repos';
import { useSaveResumeDocument } from '@nextkin/shared/queries';
import { useCallback, useEffect, useRef, useState } from 'react';

import { sameWrite, toWrite } from './editorModel';
import { clearBackup, writeBackup } from './editorBackup';

/**
 * Autosave for the editor (toreview §124). A change is saved 1.2 s after the typing stops, one
 * save at a time; whatever changed meanwhile goes in the next one. Every unsaved change is also
 * kept in this browser (`editorBackup.ts`) until the server has it, so a closed tab, a crash or a
 * dropped connection loses nothing.
 *
 * - A network or server failure retries by itself, waiting longer each time; "Retry now" skips the wait.
 * - A save from an older revision is a conflict: autosave stops and the user chooses.
 * - A change the server refuses as invalid is shown, and the next edit tries again.
 */

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'retrying' | 'conflict' | 'failed';

const IDLE_MS = 1200;
const BACKOFF_MS = [2000, 5000, 10000, 20000, 30000];

export function useAutosave(
  id: string,
  doc: ResumeDocument | null,
  stamp: (versionId: string, revision: string, pendingReview?: boolean) => void,
) {
  const save = useSaveResumeDocument(id);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [message, setMessage] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saved = useRef<ResumeDocumentWrite | null>(null);
  const latest = useRef<ResumeDocument | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempt = useRef(0);
  const stopped = useRef(false);
  const runRef = useRef<() => Promise<boolean>>(() => Promise.resolve(true));
  useEffect(() => {
    latest.current = doc;
  });

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const run = useCallback(async (): Promise<boolean> => {
    const doc = latest.current;
    if (!doc) return true;
    if (inFlight.current) {
      await inFlight.current;
      return runRef.current();
    }
    const write = toWrite(doc);
    if (saved.current && sameWrite(write, saved.current)) {
      setStatus('saved');
      return true;
    }
    setStatus('saving');
    const promise = save
      .mutateAsync({ write, baseRevision: doc.revision })
      .then((result) => {
        saved.current = write;
        attempt.current = 0;
        stamp(result.versionId, result.revision, result.pendingReview);
        setSavedAt(new Date());
        setMessage(null);
        const now = latest.current;
        if (now && !sameWrite(toWrite(now), write)) setStatus('unsaved');
        else {
          setStatus('saved');
          clearBackup(id);
        }
        return true;
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.code === 'PRECONDITION_FAILED') {
          stopped.current = true;
          setStatus('conflict');
          setMessage('This resume was changed in another tab or device since you opened it.');
        } else if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
          setStatus('failed');
          setMessage(
            'Part of this change doesn’t fit a resume (a line may be too long). Edit it and it will save again.',
          );
        } else {
          const wait = BACKOFF_MS[Math.min(attempt.current, BACKOFF_MS.length - 1)]!;
          attempt.current += 1;
          setStatus('retrying');
          setMessage(
            'Couldn’t reach NextKin. Your changes are kept on this device and will save when the connection is back.',
          );
          clearTimer();
          timer.current = setTimeout(() => void runRef.current(), wait);
        }
        return false;
      })
      .finally(() => {
        inFlight.current = null;
      });
    inFlight.current = promise;
    return promise;
  }, [id, save, stamp]);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  // A new document (loaded, or reloaded after a conflict) is the saved baseline.
  const baseline = useCallback((loaded: ResumeDocument) => {
    saved.current = toWrite(loaded);
    stopped.current = false;
    attempt.current = 0;
    setStatus('saved');
    setMessage(null);
  }, []);

  useEffect(() => {
    latest.current = doc;
    if (!doc || !saved.current || stopped.current) return;
    if (sameWrite(toWrite(doc), saved.current)) return;
    writeBackup(id, { revision: doc.revision, write: toWrite(doc) });
    setStatus((s) => (s === 'saving' || s === 'retrying' ? s : 'unsaved'));
    clearTimer();
    timer.current = setTimeout(() => void run(), IDLE_MS);
  }, [doc, id, run]);

  useEffect(() => clearTimer, []);

  // Leaving with changes the server doesn't have yet asks first.
  useEffect(() => {
    if (status === 'saved') return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

  const saveNow = useCallback(() => {
    clearTimer();
    if (stopped.current) return Promise.resolve(false);
    attempt.current = 0;
    return run();
  }, [run]);

  return { status, message, savedAt, saveNow, baseline };
}
