'use client';

import { useState } from 'react';

import type { SkillsOverview, UnmappedTerm } from '@nextkin/shared/models';
import { useAddCategory } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty } from '../../ui/AdminCard';
import { AdminDialog } from '../../ui/AdminDialog';
import { TextField } from '../../ui/AdminForm';
import { errorMessage, formatCount } from '../format';
import { ActionButton, TextAction } from '../ui/ContentBits';
import { MapDialog } from './MapDialog';

const UNMAPPED_SHOWN = 5;

/** The taxonomy's categories, the one open highlighted (Figma 406:1829 "Taxonomy"). */
export function TaxonomyCard({
  overview,
  categoryId,
  onCategory,
}: {
  overview: SkillsOverview;
  categoryId: string;
  onCategory: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const add = useAddCategory();
  return (
    <AdminCard
      icon="LayoutAlt01"
      title="Taxonomy"
      trailing={<AdminBadge tone="neutral">{overview.categories.length} categories</AdminBadge>}
      bodyClassName="gap-0.5 p-2"
    >
      <ul className="flex flex-col gap-0.5">
        {overview.categories.map((category) => {
          const open = category.id === categoryId;
          return (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => onCategory(category.id)}
                aria-current={open ? 'true' : undefined}
                className={cn(
                  'flex h-11 w-full items-center gap-2 rounded-sm px-3 text-left text-body-s transition-colors duration-press ease-standard focus-visible:outline-2 focus-visible:outline-brand-600',
                  open
                    ? 'bg-brand-50 font-semibold text-brand-700'
                    : 'font-medium text-neutral-700 hover:bg-neutral-50',
                )}
              >
                <span className="flex-1 truncate">{category.name}</span>
                <AdminBadge tone={open ? 'brand' : 'neutral'}>
                  {formatCount(category.count)}
                </AdminBadge>
                {open && <AdminIcon name="ChevronRight" size="sm" />}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-neutral-100 px-3 pb-1 pt-2.5">
        <TextAction
          icon="Plus"
          size="md"
          onClick={() => setAdding(true)}
          className="flex-row-reverse"
        >
          Add category
        </TextAction>
      </div>
      <AdminDialog
        open={adding}
        onOpenChange={setAdding}
        icon="Plus"
        tone="brand"
        title="Add a category"
        description="Skills are grouped under categories; the change is audited."
        confirm={{
          label: 'Add category',
          disabled: !name.trim(),
          busy: add.isPending,
          onConfirm: () =>
            add.mutate(name.trim(), {
              onSuccess: () => {
                showToast(`${name.trim()} added`);
                setName('');
                setAdding(false);
              },
              onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
            }),
        }}
      >
        <TextField
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Security"
        />
      </AdminDialog>
    </AdminCard>
  );
}

/**
 * Terms resume parsing met this week and couldn't match to a skill (406:1829 "Unmapped this
 * week"). Map makes one an alias of an existing skill.
 */
export function UnmappedCard({ overview }: { overview: SkillsOverview }) {
  const [mapping, setMapping] = useState<UnmappedTerm | null>(null);
  const [all, setAll] = useState(false);
  const shown = overview.unmapped.slice(0, UNMAPPED_SHOWN);
  return (
    <AdminCard
      icon="HelpCircle"
      title="Unmapped this week"
      trailing={<AdminBadge tone="warning">{overview.stats.unmapped}</AdminBadge>}
      bodyClassName="py-1"
    >
      {shown.length === 0 ? (
        <CardEmpty title="All mapped" message="Every term parsing met this week matched a skill." />
      ) : (
        <>
          <ul>
            {shown.map((term) => (
              <Term key={term.term} term={term} onMap={() => setMapping(term)} />
            ))}
          </ul>
          <div className="py-3">
            <TextAction icon="ArrowRight" size="md" onClick={() => setAll(true)}>
              View all {overview.stats.unmapped}
            </TextAction>
          </div>
        </>
      )}
      <AdminDialog
        open={all}
        onOpenChange={setAll}
        icon="HelpCircle"
        tone="warning"
        title={`Unmapped this week · ${overview.stats.unmapped}`}
        description={`Showing ${overview.unmapped.length} of ${overview.stats.unmapped}, most seen first.`}
      >
        <ul className="max-h-[360px] overflow-y-auto">
          {overview.unmapped.map((term) => (
            <Term
              key={term.term}
              term={term}
              onMap={() => {
                setAll(false);
                setMapping(term);
              }}
            />
          ))}
        </ul>
      </AdminDialog>
      {mapping && <MapDialog key={mapping.term} term={mapping} onClose={() => setMapping(null)} />}
    </AdminCard>
  );
}

function Term({ term, onMap }: { term: UnmappedTerm; onMap: () => void }) {
  return (
    <li className="flex items-center gap-3 border-b border-neutral-100 py-2.5">
      <span className="flex min-w-0 flex-1 flex-col text-body-s">
        <span className="font-semibold text-text-primary">{term.term}</span>
        <span className="text-text-secondary">Seen in {formatCount(term.seenIn)} resumes</span>
      </span>
      <ActionButton variant="small" onClick={onMap} label={`Map ${term.term}`}>
        Map
      </ActionButton>
    </li>
  );
}

/** Who may change the taxonomy (406:1829 "Who can edit"). */
export function WhoCanEditCard() {
  return (
    <AdminCard icon="ShieldTick" title="Who can edit" bodyClassName="gap-2">
      <p className="text-body-s text-text-secondary">
        Curators and Admins edit the taxonomy. Support can view it. Each change records who made it
        and why.
      </p>
      <TextAction href="/admin/audit" icon="ArrowUpRight" size="md">
        View in audit log
      </TextAction>
    </AdminCard>
  );
}
