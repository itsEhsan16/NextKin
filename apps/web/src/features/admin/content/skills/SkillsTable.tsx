'use client';

import { useState } from 'react';

import type { MergeSuggestion, Skill } from '@nextkin/shared/models';
import { useResolveMerge, useSetAliases } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty } from '../../ui/AdminCard';
import { AdminDialog } from '../../ui/AdminDialog';
import { TextField } from '../../ui/AdminForm';
import { adminTable, SortHeader } from '../../ui/AdminTable';
import { FeaturedIcon } from '../../ui/FeaturedIcon';
import { errorMessage, formatCount, formatPaddedDay, formatPaddedShort } from '../format';
import { ActionButton, AliasChips, TextAction } from '../ui/ContentBits';
import { RowMenu } from '../ui/RowMenu';

/**
 * The board's columns sit 16px apart (406:2114), so the cells pad 8 a side; each width below is
 * the board's content width plus that padding (24 before the first, 16 after the ⋮).
 */
const th = cn(adminTable.th, 'px-2 first:pl-6 last:pr-4');
const td = cn(adminTable.td, 'px-2 first:pl-6 last:pr-4');

/** A category's skills (Figma 406:1829): aliases, parent, how many resumes use it, last edit. */
export function SkillsTable({
  rows,
  sort,
  onSort,
}: {
  rows: Skill[];
  sort: 'asc' | 'desc' | null;
  onSort: () => void;
}) {
  const [editing, setEditing] = useState<Skill | null>(null);
  return (
    <div className="overflow-x-auto">
      <table className={cn(adminTable.table, 'min-w-[960px]')}>
        <thead className={adminTable.head}>
          <tr>
            <th scope="col" className={cn(th, 'w-[232px]')}>
              Skill
            </th>
            <th scope="col" className={th}>
              Aliases
            </th>
            <th scope="col" className={cn(th, 'w-[216px]')}>
              Parent category
            </th>
            <th
              scope="col"
              className={cn(th, 'w-[146px] whitespace-nowrap')}
              aria-sort={sort === null ? 'none' : sort === 'asc' ? 'ascending' : 'descending'}
            >
              <SortHeader label="Used in resumes" direction={sort} onToggle={onSort} />
            </th>
            <th scope="col" className={cn(th, 'w-[156px]')}>
              Last edited
            </th>
            <th scope="col" className={cn(th, 'w-[44px]')}>
              <span className="sr-only">More</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((skill) => (
            <tr key={skill.id} className={adminTable.row}>
              <td className={cn(td, 'font-semibold text-text-primary')}>{skill.name}</td>
              <td className={td}>
                <AliasChips aliases={skill.aliases} empty="No aliases" pill />
              </td>
              <td className={td}>{skill.parent}</td>
              <td className={td}>{formatCount(skill.usedIn)}</td>
              <td className={td}>
                <div className="flex flex-col">
                  <span className="text-text-primary">{formatPaddedDay(skill.editedAt)}</span>
                  <span>{skill.editedBy}</span>
                </div>
              </td>
              <td className={td}>
                <RowMenu
                  label={skill.name}
                  actions={[{ label: 'Edit aliases', onSelect: () => setEditing(skill) }]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <AliasesDialog key={editing.id} skill={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

/** Add or remove a skill's aliases; each is matched as the skill from then on. */
function AliasesDialog({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const save = useSetAliases();
  const [aliases, setAliases] = useState(skill.aliases);
  const [draft, setDraft] = useState('');
  const add = () => {
    const next = draft.trim();
    if (!next || aliases.some((a) => a.toLowerCase() === next.toLowerCase())) return;
    setAliases([...aliases, next]);
    setDraft('');
  };
  return (
    <AdminDialog
      open
      onOpenChange={(open) => !open && onClose()}
      icon="Tag01"
      tone="brand"
      title={`Aliases of ${skill.name}`}
      description="Resume parsing and the ATS check read each alias as this skill. The edit is audited."
      confirm={{
        label: 'Save aliases',
        busy: save.isPending,
        disabled: aliases.join('|') === skill.aliases.join('|'),
        onConfirm: () =>
          save.mutate(
            { skillId: skill.id, aliases },
            {
              onSuccess: () => {
                showToast(`Aliases of ${skill.name} saved`);
                onClose();
              },
              onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
            },
          ),
      }}
    >
      <div className="flex flex-col gap-4">
        <ul className="flex flex-wrap gap-2" aria-label="Current aliases">
          {aliases.length === 0 && (
            <li className="text-body-s text-text-tertiary">No aliases yet</li>
          )}
          {aliases.map((alias) => (
            <li
              key={alias}
              className="flex items-center gap-1 rounded-[6px] border border-neutral-200 bg-surface-card py-0.5 pl-2 pr-1 text-caption-m text-neutral-700"
            >
              {alias}
              <button
                type="button"
                aria-label={`Remove ${alias}`}
                onClick={() => setAliases(aliases.filter((a) => a !== alias))}
                className="relative flex size-4 items-center justify-center rounded-[3px] text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 after:absolute after:-inset-3"
              >
                <AdminIcon name="XClose" size="xs" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <TextField
              label="Add an alias"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="k8s.io"
            />
          </div>
          <ActionButton icon="Plus" onClick={add} disabled={!draft.trim()}>
            Add
          </ActionButton>
        </div>
      </div>
    </AdminDialog>
  );
}

const MERGES_SHOWN = 4;

/** Terms parsing thinks are aliases of a skill (406:1829 "Merge suggestions"): merge or dismiss. */
export function MergesCard({ merges, total }: { merges: MergeSuggestion[]; total: number }) {
  const resolve = useResolveMerge();
  const [all, setAll] = useState(false);
  const shown = all ? merges : merges.slice(0, MERGES_SHOWN);
  const act = (merge: MergeSuggestion, decision: 'merge' | 'dismiss') =>
    resolve.mutate(
      { id: merge.id, decision },
      {
        onSuccess: () =>
          showToast(
            decision === 'merge'
              ? `${merge.alias} is now an alias of ${merge.target}`
              : `Dismissed ${merge.alias}`,
          ),
        onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
      },
    );
  return (
    <AdminCard
      icon="GitBranch01"
      title="Merge suggestions"
      trailing={<AdminBadge tone="brand">{total} open</AdminBadge>}
      bodyClassName="py-1"
    >
      {merges.length === 0 ? (
        <CardEmpty title="No suggestions" message="Parsing hasn't flagged a likely alias lately." />
      ) : (
        <>
          <ul>
            {shown.map((merge) => (
              <li
                key={merge.id}
                className="flex items-center gap-3.5 border-b border-neutral-100 py-4"
              >
                <FeaturedIcon name="GitBranch01" tone="brand" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-body-s">
                  <p className="font-semibold text-text-primary">
                    “{merge.alias}” looks like an alias of “{merge.target}” — seen in{' '}
                    {formatCount(merge.seenIn)} resumes
                  </p>
                  <p className="text-text-secondary">
                    First seen {formatPaddedShort(merge.firstSeen)} · merging maps {merge.alias} to{' '}
                    {merge.target} and keeps it as an alias
                  </p>
                </div>
                <ActionButton
                  variant="small"
                  onClick={() => act(merge, 'merge')}
                  label={`Merge ${merge.alias} into ${merge.target}`}
                >
                  Merge
                </ActionButton>
                <TextAction
                  size="md"
                  onClick={() => act(merge, 'dismiss')}
                  label={`Dismiss ${merge.alias}`}
                  className="self-center"
                >
                  Dismiss
                </TextAction>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 py-3 text-body-s text-text-secondary">
            <AdminIcon name="InfoCircle" size="sm" className="text-neutral-400" />
            <p className="flex-1">
              Showing {shown.length} of {total}. Merges are audited and can be undone from the audit
              log.
            </p>
            {merges.length > MERGES_SHOWN && (
              <TextAction size="md" onClick={() => setAll((open) => !open)} className="self-center">
                {all ? 'Show fewer' : `View all ${total}`}
              </TextAction>
            )}
          </div>
        </>
      )}
    </AdminCard>
  );
}
