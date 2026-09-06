import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { sameDraft, type Validation } from '../../profileForms';
import type { ProfileFormStatus } from './ProfileFormShell';

/** The route param a form gets when there is nothing to load yet. */
export const NEW_ENTRY = 'new';

export type EntryFormOptions<TDraft extends Record<string, unknown>, TEntry> = {
  /** An existing entry's id, or the literal 'new'. */
  id: string;
  /** That entry, once the profile has loaded. Undefined on a new form, or an id nothing matches. */
  entry: TEntry | undefined;
  loading: boolean;
  failed: boolean;
  /** Stable module-level functions from `profileForms` — they seed the draft and gate `dirty`. */
  blank: () => TDraft;
  toDraft: (entry: TEntry) => TDraft;
  validate: (draft: TDraft) => Validation;
};

export type EntryForm<TDraft> = {
  isNew: boolean;
  status: ProfileFormStatus;
  /** Defined whenever `status` is 'ready'. */
  draft: TDraft | undefined;
  patch: (part: Partial<TDraft>) => void;
  /** Only the messages the reader has earned: a touched field, or a refused Save. */
  errors: Record<string, string>;
  blur: (key: string) => void;
  dirty: boolean;
  valid: boolean;
  /** The draft when it may be saved; otherwise undefined, with every message now visible. */
  submit: () => TDraft | undefined;
};

/**
 * The engine behind all four profile entry forms (V2 §7.3): load an entry, seed a draft from it,
 * and answer the three questions the shell asks — has it changed, is it valid, and may it be sent.
 *
 * The draft lives on the screen rather than behind a `key` on the fields, because the pinned bar
 * and the discard sheet are the fields' siblings and all three read it (the trade-off
 * `SectionEditorScreen` explains). Seeding is therefore an effect keyed on the loaded entry's id:
 * a refetch that changed nothing re-seeds nothing, and a half-typed edit survives it.
 */
export function useEntryForm<TDraft extends Record<string, unknown>, TEntry>({
  id,
  entry,
  loading,
  failed,
  blank,
  toDraft,
  validate,
}: EntryFormOptions<TDraft, TEntry>): EntryForm<TDraft> {
  const isNew = id === NEW_ENTRY || id.length === 0;

  const [draft, setDraft] = useState<TDraft | undefined>(undefined);
  /** Fields the reader has left. An error on the first keystroke reads as a telling-off. */
  const [touched, setTouched] = useState<Record<string, true>>({});
  const [refused, setRefused] = useState(false);

  // `entry` is the object React Query holds, so it is referentially stable between refetches
  // that changed nothing — which is what keeps this memo, and the effect below, still.
  const seed = useMemo(
    () => (entry ? toDraft(entry) : isNew ? blank() : undefined),
    [blank, entry, isNew, toDraft],
  );

  const stamp = entry ? id : isNew ? NEW_ENTRY : undefined;
  const seeded = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!stamp || !seed || seeded.current === stamp) return;
    seeded.current = stamp;
    setDraft(seed);
    setTouched({});
    setRefused(false);
  }, [seed, stamp]);

  // The seed stands in until the effect above has run, so the first ready frame already draws
  // the loaded values rather than an empty form.
  const active = draft ?? seed;
  const check = active ? validate(active) : undefined;
  const allErrors = check && !check.ok ? check.errors : {};
  const errors: Record<string, string> = {};
  for (const [key, message] of Object.entries(allErrors)) {
    if (refused || touched[key]) errors[key] = message;
  }

  const patch = useCallback(
    (part: Partial<TDraft>) => {
      setDraft((current) => {
        const base = current ?? seed;
        return base ? { ...base, ...part } : current;
      });
    },
    [seed],
  );

  const blur = useCallback((key: string) => setTouched((t) => ({ ...t, [key]: true })), []);

  const submit = useCallback(() => {
    if (!active) return undefined;
    if (!validate(active).ok) {
      setRefused(true);
      return undefined;
    }
    return active;
  }, [active, validate]);

  const status: ProfileFormStatus = loading
    ? 'loading'
    : failed
      ? 'error'
      : !isNew && !entry
        ? 'missing'
        : 'ready';

  return {
    isNew,
    status,
    draft: active,
    patch,
    errors,
    blur,
    dirty: draft != null && seed != null && !sameDraft(draft, seed),
    valid: check?.ok === true,
    submit,
  };
}
