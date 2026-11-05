'use client';

import { useDeferredValue, useState } from 'react';

import type { TemplateSort, TemplateStatus } from '@nextkin/shared/models';
import { useAdminTemplates, useCreateTemplate } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { AdminIcon } from '@/ui/animated/AdminIcon';
import { FilterCheckboxItem, FilterDropdown } from '@/ui/FilterDropdown';
import { chevronTurn, menuTrigger } from '@/ui/menuMotion';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { AdminCard, CardEmpty } from '../../ui/AdminCard';
import { adminButton } from '../../ui/adminButton';
import { AdminDialog } from '../../ui/AdminDialog';
import { RadioCardGroup, TextField } from '../../ui/AdminForm';
import { AdminPage } from '../../ui/AdminPage';
import { ButtonGroup } from '../../ui/ButtonGroup';
import { SearchField } from '../../ui/SearchField';
import { errorMessage } from '../format';
import { TemplateCard } from '../templates/TemplateCard';
import { ActionButton, InfoAlert } from '../ui/ContentBits';

type Tab = 'all' | TemplateStatus;

const SORTS: { id: TemplateSort; label: string }[] = [
  { id: 'most_used', label: 'Most used' },
  { id: 'recent', label: 'Recently edited' },
  { id: 'name', label: 'Name' },
];

/**
 * Templates (Figma 407:1841): the resume templates users pick from, with their certification,
 * state and use. Each edit makes a new revision and every change is audited.
 */
export function TemplatesScreen() {
  const templates = useAdminTemplates();
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<TemplateSort>('most_used');
  const [creating, setCreating] = useState(false);
  const needle = useDeferredValue(query).trim().toLowerCase();

  const all = templates.data ?? [];
  // No count until the list has loaded: a zero there would claim there are no templates.
  const count = (status: Tab) =>
    templates.isSuccess
      ? status === 'all'
        ? all.length
        : all.filter((t) => t.status === status).length
      : undefined;
  const tabOption = (id: Tab, label: string) => ({
    id,
    label,
    count: count(id),
    countTone: id === tab ? ('brand' as const) : ('neutral' as const),
  });
  const shown = all
    .filter(
      (t) =>
        (tab === 'all' || t.status === tab) && (!needle || t.name.toLowerCase().includes(needle)),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'recent'
          ? b.editedAt.localeCompare(a.editedAt)
          : // Most used keeps the archived ones after the live ones, as the board orders them.
            Number(a.status === 'archived') - Number(b.status === 'archived') || b.inUse - a.inUse,
    );

  return (
    <AdminPage
      title="Templates"
      subtitle="Resume templates users can pick from. Each edit makes a new revision, and every change is audited."
      actions={
        <ActionButton
          variant="primary"
          icon="Plus"
          onClick={() => setCreating(true)}
          // A new template starts as a copy of an existing one, so it needs one to copy.
          disabled={!templates.data?.length}
        >
          New template
        </ActionButton>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <ButtonGroup
          label="Templates to show"
          size="md"
          value={tab}
          onChange={setTab}
          options={[
            tabOption('all', 'All'),
            tabOption('published', 'Published'),
            tabOption('draft', 'Drafts'),
            tabOption('archived', 'Archived'),
          ]}
        />
        <span className="flex-1" />
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search templates"
          className="w-[280px]"
        />
        <FilterDropdown
          align="end"
          trigger={
            <button
              type="button"
              aria-label={`Sort: ${SORTS.find((s) => s.id === sort)?.label}`}
              className={cn(adminButton.secondary, menuTrigger)}
            >
              {SORTS.find((s) => s.id === sort)?.label}
              <AdminIcon
                name="ChevronDown"
                size="sm"
                className={cn('text-neutral-500', chevronTurn)}
              />
            </button>
          }
        >
          {SORTS.map((option) => (
            <FilterCheckboxItem
              key={option.id}
              checked={option.id === sort}
              onCheckedChange={() => setSort(option.id)}
              closeOnSelect
            >
              {option.label}
            </FilterCheckboxItem>
          ))}
        </FilterDropdown>
      </div>

      {templates.isError ? (
        <StateView
          tone="danger"
          title="Couldn’t load the templates"
          actionLabel="Try again"
          onAction={() => void templates.refetch()}
        />
      ) : templates.isPending ? (
        <div aria-hidden className="grid gap-6 @min-[1100px]/admin:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[469px] rounded-lg" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <AdminCard icon="File06" title="Templates">
          <CardEmpty
            title={all.length ? 'No templates match' : 'No templates yet'}
            message={
              all.length
                ? 'Try another name or tab.'
                : 'Templates users can pick from appear here once one is added.'
            }
          />
        </AdminCard>
      ) : (
        <div className="grid gap-6 @min-[700px]/admin:grid-cols-2 @min-[1100px]/admin:grid-cols-3">
          {shown.map((template) => (
            <TemplateCard key={template.slug} template={template} />
          ))}
        </div>
      )}

      <InfoAlert title="Archive, don’t delete">
        A template that’s in use is archived, not deleted. Publishing new templates waits for
        sign-off (Q-06).
      </InfoAlert>

      {templates.data && templates.data.length > 0 && (
        <NewTemplateDialog
          open={creating}
          onOpenChange={setCreating}
          bases={templates.data.map((t) => ({ id: t.slug, label: t.name }))}
        />
      )}
    </AdminPage>
  );
}

function NewTemplateDialog({
  open,
  onOpenChange,
  bases,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bases: { id: string; label: string }[];
}) {
  const create = useCreateTemplate();
  const [name, setName] = useState('');
  const [base, setBase] = useState<string | null>(bases[0]?.id ?? null);
  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      icon="Plus"
      tone="brand"
      title="New template"
      description="It starts as a draft copy of the template you pick. It can be published once its ATS check passes and it's signed off."
      confirm={{
        label: 'Create draft',
        disabled: !name.trim() || !base,
        busy: create.isPending,
        onConfirm: () =>
          base &&
          create.mutate(
            { name: name.trim(), basedOn: base },
            {
              onSuccess: (t) => {
                showToast(`${t.name} created as a draft`);
                setName('');
                onOpenChange(false);
              },
              onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
            },
          ),
      }}
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Minimal"
        />
        <div className="max-h-[240px] overflow-y-auto">
          <RadioCardGroup
            label="Start from"
            required
            value={base}
            onChange={setBase}
            options={bases}
          />
        </div>
      </div>
    </AdminDialog>
  );
}
