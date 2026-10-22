'use client';

import type { DocRole, DocRoleGroup } from '@nextkin/shared/models';

import { PlusIcon, TrashIcon } from '@/ui/icons';

import { blankLine, blankRole, move, newId } from '../editorModel';
import { periodText } from '../period';
import { BulletList } from './BulletList';
import { DateRange } from './DateRange';
import { EntryCard } from './EntryCard';
import { FieldRow, TextField } from './fields';
import { AddButton } from './AddButton';
import { cn } from '@/lib/cn';
import { removeButton, toolIcon } from './controls';

/**
 * Experience (toreview §124): each role with its employer, title, place, dates and bullets, and
 * the client projects an agency or consulting role groups its work under — as an uploaded resume
 * groups them, so editing one keeps the page's shape.
 */
export function ExperienceForm({
  roles,
  flagged,
  onChange,
}: {
  roles: DocRole[];
  flagged: ReadonlySet<string>;
  onChange: (roles: DocRole[], key: string) => void;
}) {
  const setRole = (index: number, patch: Partial<DocRole>, key: string) =>
    onChange(
      roles.map((r, i) => (i === index ? { ...r, ...patch } : r)),
      `role.${roles[index]?.id}.${key}`,
    );
  const setGroup = (index: number, gi: number, patch: Partial<DocRoleGroup>, key: string) => {
    const role = roles[index]!;
    setRole(
      index,
      { groups: role.groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)) },
      `group.${role.groups[gi]?.id}.${key}`,
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {roles.length === 0 && (
        <p className="text-body-s text-text-tertiary">
          No roles yet. Add the jobs, internships or freelance work you want employers to see,
          newest first.
        </p>
      )}
      {roles.map((role, index) => (
        <EntryCard
          key={role.id}
          entryId={role.id}
          kind="Role"
          title={[role.title, role.company].filter((s) => s.trim()).join(' · ')}
          subtitle={periodText(role.start, role.end)}
          index={index}
          count={roles.length}
          flagged={flagged.has(role.id)}
          defaultOpen={!role.company && !role.title}
          onMove={(by) => onChange(move(roles, index, by), 'roles.order')}
          onRemove={() =>
            onChange(
              roles.filter((_, i) => i !== index),
              'roles.remove',
            )
          }
        >
          {role.assumed && (
            <p className="rounded-md bg-warning-50 px-3 py-2 text-caption-m text-warning-text">
              Zero Resume guessed this role. Check every detail before you download.
            </p>
          )}
          <FieldRow>
            <TextField
              label="Job title"
              value={role.title}
              invalid={!role.title.trim()}
              onChange={(title) => setRole(index, { title }, 'title')}
              placeholder="e.g. Software Engineer"
            />
            <TextField
              label="Company"
              value={role.company}
              invalid={!role.company.trim()}
              onChange={(company) => setRole(index, { company }, 'company')}
              placeholder="e.g. Northwind"
            />
          </FieldRow>
          <DateRange
            start={role.start}
            end={role.end}
            labels={['Start', 'End']}
            before={
              <TextField
                label="Location"
                value={role.location}
                className="min-w-40 flex-1"
                onChange={(location) => setRole(index, { location }, 'location')}
                placeholder="City, or Remote"
              />
            }
            onChange={(dates) => setRole(index, dates, 'dates')}
          />
          <BulletList
            label="What you did"
            lines={role.bullets}
            onChange={(bullets) => setRole(index, { bullets }, 'bullets')}
          />

          {role.groups.map((group, gi) => (
            <div
              key={group.id}
              className="flex flex-col gap-3 rounded-md border border-border-faint bg-neutral-50 p-3"
            >
              <div className="flex items-end gap-2">
                <FieldRow className="flex-1">
                  <TextField
                    label="Client project"
                    value={group.title}
                    onChange={(title) => setGroup(index, gi, { title }, 'title')}
                    placeholder="e.g. Checkout rebuild"
                  />
                  <TextField
                    label="Stack (optional)"
                    value={group.tech}
                    maxLength={300}
                    onChange={(tech) => setGroup(index, gi, { tech }, 'tech')}
                    placeholder="React, Node.js"
                  />
                </FieldRow>
                <button
                  type="button"
                  aria-label={`Remove ${group.title || 'this client project'}`}
                  onClick={() =>
                    setRole(index, { groups: role.groups.filter((_, i) => i !== gi) }, 'groups')
                  }
                  className={cn(removeButton, 'mb-0.5')}
                >
                  <TrashIcon aria-hidden className={toolIcon} />
                </button>
              </div>
              <BulletList
                label={`${group.title || 'Client project'}: what you did`}
                lines={group.bullets}
                onChange={(bullets) => setGroup(index, gi, { bullets }, 'bullets')}
              />
            </div>
          ))}
          {role.groups.length < 6 && (
            <button
              type="button"
              onClick={() =>
                setRole(
                  index,
                  {
                    groups: [
                      ...role.groups,
                      { id: newId('g'), title: '', tech: '', bullets: [blankLine()] },
                    ],
                  },
                  'groups',
                )
              }
              className="flex h-8 items-center gap-1.5 self-start rounded-md px-2 text-body-s font-semibold text-text-secondary transition-colors duration-press ease-standard hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              <PlusIcon aria-hidden className="size-3.5" />
              Group work under a client project
            </button>
          )}
        </EntryCard>
      ))}
      {roles.length < 20 && (
        <AddButton
          label="Add a role"
          onClick={() => onChange([blankRole(), ...roles], 'roles.add')}
        />
      )}
    </div>
  );
}
