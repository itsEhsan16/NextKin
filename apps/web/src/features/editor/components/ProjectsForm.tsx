'use client';

import type { DocProject } from '@nextkin/shared/models';

import { blankProject, move } from '../editorModel';
import { periodText } from '../period';
import { AddButton } from './AddButton';
import { BulletList } from './BulletList';
import { DateRange } from './DateRange';
import { EntryCard } from './EntryCard';
import { FieldRow, TextField } from './fields';

/** Projects (toreview §124): a name, its stack, a line about it, dates if wanted, and bullets. */
export function ProjectsForm({
  projects,
  flagged,
  onChange,
}: {
  projects: DocProject[];
  flagged: ReadonlySet<string>;
  onChange: (projects: DocProject[], key: string) => void;
}) {
  const set = (index: number, patch: Partial<DocProject>, key: string) =>
    onChange(
      projects.map((p, i) => (i === index ? { ...p, ...patch } : p)),
      `project.${projects[index]?.id}.${key}`,
    );
  return (
    <div className="flex flex-col gap-2">
      {projects.length === 0 && (
        <p className="text-body-s text-text-tertiary">
          Side projects, open source or coursework that shows what you can build.
        </p>
      )}
      {projects.map((project, index) => (
        <EntryCard
          key={project.id}
          entryId={project.id}
          kind="Project"
          title={project.name}
          subtitle={[project.tech, periodText(project.start, project.end)]
            .filter(Boolean)
            .join(' · ')}
          index={index}
          count={projects.length}
          flagged={flagged.has(project.id)}
          defaultOpen={!project.name}
          onMove={(by) => onChange(move(projects, index, by), 'projects.order')}
          onRemove={() =>
            onChange(
              projects.filter((_, i) => i !== index),
              'projects.remove',
            )
          }
        >
          <FieldRow>
            <TextField
              label="Project name"
              value={project.name}
              invalid={!project.name.trim()}
              onChange={(name) => set(index, { name }, 'name')}
              placeholder="e.g. Shortlink"
            />
            <TextField
              label="Stack (optional)"
              value={project.tech}
              maxLength={300}
              onChange={(tech) => set(index, { tech }, 'tech')}
              placeholder="TypeScript, SQL"
            />
          </FieldRow>
          <TextField
            label="One line about it (optional)"
            value={project.description}
            maxLength={1000}
            onChange={(description) => set(index, { description }, 'description')}
            placeholder="A link shortener with click analytics"
          />
          <DateRange
            start={project.start}
            end={project.end}
            onChange={(dates) => set(index, dates, 'dates')}
          />
          <BulletList
            label="Highlights"
            lines={project.bullets}
            max={8}
            onChange={(bullets) => set(index, { bullets }, 'bullets')}
          />
        </EntryCard>
      ))}
      {projects.length < 10 && (
        <AddButton
          label="Add a project"
          onClick={() => onChange([...projects, blankProject()], 'projects.add')}
        />
      )}
    </div>
  );
}
