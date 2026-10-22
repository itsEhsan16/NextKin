import type { ResumeDocumentWrite } from '@nextkin/shared/models';

/**
 * Unsaved editor changes kept in this browser until the server has them (toreview §124). A
 * convenience on top of autosave, never the record: storage can be off or full, so every call is
 * guarded and a miss just means there is nothing to restore.
 */

export type EditorBackup = { revision: string; write: ResumeDocumentWrite; at: string };

const key = (id: string) => `nextkin:editor:${id}`;

export function writeBackup(id: string, backup: Omit<EditorBackup, 'at'>): void {
  try {
    window.localStorage.setItem(
      key(id),
      JSON.stringify({ ...backup, at: new Date().toISOString() }),
    );
  } catch {
    // Storage off or full: autosave still has the change.
  }
}

export function readBackup(id: string): EditorBackup | null {
  try {
    const raw = window.localStorage.getItem(key(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EditorBackup>;
    return parsed.revision && parsed.write && parsed.at ? (parsed as EditorBackup) : null;
  } catch {
    return null;
  }
}

export function clearBackup(id: string): void {
  try {
    window.localStorage.removeItem(key(id));
  } catch {
    // Nothing to clear.
  }
}
