'use client';

import type { ResumeDocument } from '@nextkin/shared/models';
import {
  useFetchLatestResumeDocument,
  useResumeDocument,
  useSaveResumeDocument,
} from '@nextkin/shared/queries';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { clearBackup, readBackup, type EditorBackup } from './editorBackup';
import { sameWrite, toWrite } from './editorModel';
import { useAutosave } from './useAutosave';
import { useEditorHistory } from './useEditorHistory';

/**
 * Everything the resume editor holds (toreview §124): the document, read once and then edited
 * here; undo and redo; autosave with its status; a backup from an earlier visit that never
 * reached the server, offered back; and the two ways out of a conflict.
 */
const usable = (backup: EditorBackup | null, doc: ResumeDocument): backup is EditorBackup =>
  !!backup && backup.revision === doc.revision && !sameWrite(backup.write, toWrite(doc));

export function useResumeEditor(id: string) {
  const query = useResumeDocument(id);
  const history = useEditorHistory();
  const autosave = useAutosave(id, history.doc, history.stamp);
  const forceSave = useSaveResumeDocument(id);
  const fetchLatest = useFetchLatestResumeDocument(id);
  const [dismissed, setDismissed] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const { load } = history;
  const { baseline } = autosave;

  const adopt = useCallback(
    (doc: ResumeDocument) => {
      load(doc);
      baseline(doc);
    },
    [load, baseline],
  );

  // The first read becomes the working copy; later refetches never replace what is being typed.
  useEffect(() => {
    const doc = query.data;
    if (!doc || loadedFor.current === id) return;
    loadedFor.current = id;
    adopt(doc);
    if (!usable(readBackup(id), doc)) clearBackup(id);
  }, [query.data, id, adopt]);

  // A backup from an earlier visit, read once per document; only changes made on top of this very
  // revision can come back without a conflict.
  const restorable = useMemo<EditorBackup | null>(() => {
    if (dismissed || !query.data) return null;
    const backup = readBackup(id);
    return usable(backup, query.data) ? backup : null;
  }, [dismissed, id, query.data]);

  const restore = useCallback(() => {
    if (!restorable) return;
    history.change((doc) => ({ ...doc, ...restorable.write }), null);
    setDismissed(true);
  }, [history, restorable]);

  const discardBackup = useCallback(() => {
    clearBackup(id);
    setDismissed(true);
  }, [id]);

  /** Conflict: drop what is here and take the newer copy. */
  const reloadLatest = useCallback(async () => {
    adopt(await fetchLatest());
    clearBackup(id);
  }, [adopt, fetchLatest, id]);

  /** Conflict: keep what is here, written over the newer copy. */
  const keepMine = useCallback(async () => {
    const mine = history.doc;
    if (!mine) return;
    const latest = await fetchLatest();
    const saved = await forceSave.mutateAsync({
      write: toWrite(mine),
      baseRevision: latest.revision,
    });
    adopt({ ...mine, versionId: saved.versionId, revision: saved.revision });
    clearBackup(id);
  }, [history.doc, fetchLatest, forceSave, adopt, id]);

  // Ctrl/⌘+Z, Ctrl/⌘+Shift+Z (or Y), and Ctrl/⌘+S.
  const { undo, redo } = history;
  const { saveNow } = autosave;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const k = event.key.toLowerCase();
      if (k === 's') {
        event.preventDefault();
        void saveNow();
      } else if (k === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((k === 'z' && event.shiftKey) || k === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, saveNow]);

  return {
    query,
    ...history,
    ...autosave,
    restorable,
    restore,
    discardBackup,
    reloadLatest,
    keepMine,
  };
}

export type ResumeEditor = ReturnType<typeof useResumeEditor>;
