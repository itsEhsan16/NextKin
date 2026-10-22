'use client';

import type { DocCustomEntry, DocCustomSection } from '@nextkin/shared/models';

import { blankCustomEntry, move } from '../editorModel';
import { AddButton } from './AddButton';
import { BulletList } from './BulletList';
import { EntryCard } from './EntryCard';
import { FieldRow, TextField } from './fields';

/**
 * A section the user added — Achievements, Awards, Volunteering (toreview §124). Short items are
 * lines; something with a title, a place and a date is an entry with its own bullets.
 */
export function CustomSectionForm({
  section,
  onChange,
}: {
  section: DocCustomSection;
  onChange: (section: DocCustomSection, key: string) => void;
}) {
  const setEntry = (index: number, patch: Partial<DocCustomEntry>, key: string) =>
    onChange(
      {
        ...section,
        entries: section.entries.map((e, i) => (i === index ? { ...e, ...patch } : e)),
      },
      `x.${section.entries[index]?.id}.${key}`,
    );
  return (
    <div className="flex flex-col gap-3">
      <BulletList
        label="Items"
        lines={section.lines}
        placeholder="e.g. Winner, City Hackathon 2024"
        onChange={(lines) => onChange({ ...section, lines }, `x.${section.id}.lines`)}
      />
      {section.entries.map((entry, index) => (
        <EntryCard
          key={entry.id}
          entryId={entry.id}
          kind="Entry"
          title={entry.title}
          subtitle={[entry.subtitle, entry.right].filter(Boolean).join(' · ')}
          index={index}
          count={section.entries.length}
          defaultOpen={!entry.title}
          onMove={(by) =>
            onChange({ ...section, entries: move(section.entries, index, by) }, 'x.order')
          }
          onRemove={() =>
            onChange(
              { ...section, entries: section.entries.filter((_, i) => i !== index) },
              'x.remove',
            )
          }
        >
          <FieldRow>
            <TextField
              label="Title"
              value={entry.title}
              invalid={!entry.title.trim()}
              onChange={(title) => setEntry(index, { title }, 'title')}
              placeholder="e.g. Volunteer mentor"
            />
            <TextField
              label="Date (optional)"
              value={entry.right}
              maxLength={80}
              onChange={(right) => setEntry(index, { right }, 'right')}
              placeholder="e.g. 2023 — Present"
            />
          </FieldRow>
          <FieldRow>
            <TextField
              label="Organisation (optional)"
              value={entry.subtitle}
              onChange={(subtitle) => setEntry(index, { subtitle }, 'subtitle')}
              placeholder="e.g. Code Club"
            />
            <TextField
              label="Place (optional)"
              value={entry.subRight}
              maxLength={120}
              onChange={(subRight) => setEntry(index, { subRight }, 'subRight')}
              placeholder="City, Country"
            />
          </FieldRow>
          <BulletList
            label="Details"
            lines={entry.bullets}
            max={8}
            onChange={(bullets) => setEntry(index, { bullets }, 'bullets')}
          />
        </EntryCard>
      ))}
      {section.entries.length < 8 && (
        <AddButton
          label="Add an entry with a title and date"
          onClick={() =>
            onChange({ ...section, entries: [...section.entries, blankCustomEntry()] }, 'x.add')
          }
        />
      )}
    </div>
  );
}
