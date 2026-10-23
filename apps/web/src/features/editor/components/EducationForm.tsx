'use client';

import type { DocCertification, DocEducation } from '@nextkin/shared/models';

import { XClose } from '@/ui/lineIcons';

import { blankEducation, move, newId } from '../editorModel';
import { periodText } from '../period';
import { AddButton } from './AddButton';
import { DateRange } from './DateRange';
import { EntryCard } from './EntryCard';
import { FieldRow, TextField } from './fields';
import { cn } from '@/lib/cn';
import { removeButton, toolIcon } from './controls';

/** Education (toreview §124): school, degree, field, dates, and the grade and place if wanted. */
export function EducationForm({
  entries,
  flagged,
  onChange,
}: {
  entries: DocEducation[];
  flagged: ReadonlySet<string>;
  onChange: (entries: DocEducation[], key: string) => void;
}) {
  const set = (index: number, patch: Partial<DocEducation>, key: string) =>
    onChange(
      entries.map((e, i) => (i === index ? { ...e, ...patch } : e)),
      `edu.${entries[index]?.id}.${key}`,
    );
  return (
    <div className="flex flex-col gap-2">
      {entries.length === 0 && (
        <p className="text-body-s text-text-tertiary">Add your degrees, diplomas or bootcamps.</p>
      )}
      {entries.map((entry, index) => (
        <EntryCard
          key={entry.id}
          entryId={entry.id}
          kind="School"
          title={entry.institution}
          subtitle={[
            [entry.degree, entry.field].filter(Boolean).join(', '),
            periodText(entry.start, entry.end),
          ]
            .filter(Boolean)
            .join(' · ')}
          index={index}
          count={entries.length}
          flagged={flagged.has(entry.id)}
          defaultOpen={!entry.institution && !entry.degree}
          onMove={(by) => onChange(move(entries, index, by), 'edu.order')}
          onRemove={() =>
            onChange(
              entries.filter((_, i) => i !== index),
              'edu.remove',
            )
          }
        >
          <TextField
            label="School or university"
            value={entry.institution}
            invalid={!entry.institution.trim()}
            onChange={(institution) => set(index, { institution }, 'institution')}
            placeholder="e.g. University of Toronto"
          />
          <FieldRow>
            <TextField
              label="Degree or course"
              value={entry.degree}
              invalid={!entry.degree.trim()}
              onChange={(degree) => set(index, { degree }, 'degree')}
              placeholder="e.g. BSc"
            />
            <TextField
              label="Field of study"
              value={entry.field}
              onChange={(field) => set(index, { field }, 'field')}
              placeholder="e.g. Computer Science"
            />
          </FieldRow>
          <FieldRow>
            <TextField
              label="Grade (optional)"
              value={entry.gpa}
              maxLength={60}
              onChange={(gpa) => set(index, { gpa }, 'gpa')}
              placeholder="e.g. GPA 3.8 / 4.0"
            />
            <TextField
              label="Location (optional)"
              value={entry.location}
              maxLength={120}
              onChange={(location) => set(index, { location }, 'location')}
              placeholder="City, Country"
            />
          </FieldRow>
          <DateRange
            start={entry.start}
            end={entry.end}
            onChange={(dates) => set(index, dates, 'dates')}
          />
        </EntryCard>
      ))}
      {entries.length < 10 && (
        <AddButton
          label="Add education"
          onClick={() => onChange([...entries, blankEducation()], 'edu.add')}
        />
      )}
    </div>
  );
}

/** Certifications (toreview §124): one line each, the issuer after it when given. */
export function CertificationsForm({
  items,
  onChange,
}: {
  items: DocCertification[];
  onChange: (items: DocCertification[], key: string) => void;
}) {
  const set = (index: number, patch: Partial<DocCertification>) =>
    onChange(
      items.map((c, i) => (i === index ? { ...c, ...patch } : c)),
      `cert.${items[index]?.id}`,
    );
  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && (
        <p className="text-body-s text-text-tertiary">
          Licences and certificates you hold, e.g. AWS Certified Developer.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={item.id} className="flex items-end gap-1.5">
            <FieldRow className="flex-1">
              <TextField
                label={`Certification ${index + 1}`}
                value={item.name}
                onChange={(name) => set(index, { name })}
                placeholder="e.g. AWS Certified Developer"
              />
              <TextField
                label="Issuer (optional)"
                value={item.issuer}
                onChange={(issuer) => set(index, { issuer })}
                placeholder="e.g. Amazon Web Services"
              />
            </FieldRow>
            <button
              type="button"
              aria-label={`Remove ${item.name || `certification ${index + 1}`}`}
              onClick={() =>
                onChange(
                  items.filter((_, i) => i !== index),
                  'cert.remove',
                )
              }
              className={cn(removeButton, 'mb-0.5')}
            >
              <XClose aria-hidden className={toolIcon} />
            </button>
          </li>
        ))}
      </ul>
      {items.length < 20 && (
        <AddButton
          label="Add a certification"
          onClick={() => onChange([...items, { id: newId('c'), name: '', issuer: '' }], 'cert.add')}
        />
      )}
    </div>
  );
}
