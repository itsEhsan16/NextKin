'use client';

import { useDeferredValue, useState } from 'react';

import type { UnmappedTerm } from '@nextkin/shared/models';
import { useMapTerm, useSkills } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';

import { AdminDialog } from '../../ui/AdminDialog';
import { RadioCardGroup } from '../../ui/AdminForm';
import { SearchField } from '../../ui/SearchField';
import { errorMessage } from '../format';

/**
 * Pick the skill a term becomes an alias of. The picker searches the whole taxonomy, not the
 * category open in the table, and shows the most used matches first.
 */
export function MapDialog({ term, onClose }: { term: UnmappedTerm; onClose: () => void }) {
  const map = useMapTerm();
  const [skillId, setSkillId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const found = useSkills({
    categoryId: null,
    filter: 'all',
    query: deferred,
    page: 1,
    sort: 'desc',
  });
  const skills = found.data?.rows ?? [];
  const choose = (id: string) => {
    setSkillId(id);
    setPicked(skills.find((s) => s.id === id)?.name ?? null);
  };
  return (
    <AdminDialog
      open
      onOpenChange={(open) => !open && onClose()}
      icon="Link01"
      tone="brand"
      title={`Map “${term.term}”`}
      description="It becomes an alias of the skill you pick, so parsing matches it from now on."
      confirm={{
        label: 'Map as alias',
        disabled: !skillId,
        busy: map.isPending,
        onConfirm: () =>
          skillId &&
          map.mutate(
            { term: term.term, skillId },
            {
              onSuccess: () => {
                showToast(`${term.term} mapped to ${picked ?? 'the skill'}`);
                onClose();
              },
              onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
            },
          ),
      }}
    >
      <div className="flex flex-col gap-3">
        <SearchField value={query} onChange={setQuery} placeholder="Search skills or aliases" />
        <div className="max-h-[300px] overflow-y-auto">
          {found.isError ? (
            <p role="alert" className="text-body-s text-danger-600">
              Couldn’t load the skills. Close and try again.
            </p>
          ) : found.isPending ? (
            <p className="text-body-s text-text-secondary">Loading skills…</p>
          ) : skills.length === 0 ? (
            <p className="text-body-s text-text-secondary">No skill matches “{deferred}”.</p>
          ) : (
            <RadioCardGroup
              label="Skill"
              required
              value={skills.some((s) => s.id === skillId) ? skillId : null}
              onChange={choose}
              options={skills.map((s) => ({ id: s.id, label: s.name, description: s.parent }))}
            />
          )}
        </div>
      </div>
    </AdminDialog>
  );
}
