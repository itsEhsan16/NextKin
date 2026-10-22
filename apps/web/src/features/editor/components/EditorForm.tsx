'use client';

import {
  CUSTOM_SECTION_PRESETS,
  DEFAULT_SECTION_HEADING,
  sectionHeading,
  type DocSectionKey,
  type ResumeDocument,
  type StandardSectionKey,
} from '@nextkin/shared/models';
import type { DocProblem } from '@nextkin/shared/scoring/resumeDocumentCheck';
import * as Dropdown from '@radix-ui/react-dropdown-menu';

import { PlusIcon } from '@/ui/icons';
import { menuSurfaceMotion } from '@/ui/menuMotion';

import { blankCustomSection, move } from '../editorModel';
import { headerNote, sectionNote } from '../sectionNotes';
import { CustomSectionForm } from './CustomSectionForm';
import { CertificationsForm, EducationForm } from './EducationForm';
import { ExperienceForm } from './ExperienceForm';
import { TextArea } from './fields';
import { HeaderForm } from './HeaderForm';
import { ProjectsForm } from './ProjectsForm';
import { SectionCard } from './SectionCard';
import { SkillsForm } from './SkillsForm';
import { cn } from '@/lib/cn';

/**
 * The left half of the editor (toreview §124; EDIT 01, 866:221): the header, then every section in
 * the order the page prints them, each with a count of what it holds. A section can be renamed and moved; one the user added can be removed. An
 * empty section is not printed, so nothing has to be deleted to leave it out.
 */

export type Change = (recipe: (doc: ResumeDocument) => ResumeDocument, key?: string | null) => void;

export const anchorOf = (key: DocSectionKey | 'header') => `editor-${key.replace(':', '-')}`;

const menuItem =
  'flex cursor-pointer items-center rounded-sm px-2.5 py-2 text-body-m text-text-primary outline-none data-[highlighted]:bg-surface-muted';

export function EditorForm({
  doc,
  change,
  problems,
}: {
  doc: ResumeDocument;
  change: Change;
  problems: DocProblem[];
}) {
  const flagged = new Set(problems.map((p) => p.entryId).filter((id): id is string => !!id));
  const set = <K extends keyof ResumeDocument>(field: K, value: ResumeDocument[K], key: string) =>
    change((d) => ({ ...d, [field]: value }), key);
  const moveSection = (key: DocSectionKey, by: -1 | 1) =>
    change((d) => ({ ...d, order: move(d.order, d.order.indexOf(key), by) }), 'order');
  const addSection = (heading: string) => {
    const section = blankCustomSection(heading);
    change(
      (d) => ({ ...d, custom: [...d.custom, section], order: [...d.order, `x:${section.id}`] }),
      'custom.add',
    );
    requestAnimationFrame(() =>
      document
        .getElementById(anchorOf(`x:${section.id}`))
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };
  // A new, empty resume opens every section; one with content opens what the board does.
  const blank = !doc.header.name.trim() || doc.experience.length === 0;
  const present = new Set(doc.custom.map((s) => s.heading.trim().toLowerCase()));

  const body = (key: DocSectionKey) => {
    switch (key) {
      case 'summary':
        return (
          <TextArea
            label="Summary"
            value={doc.summary}
            maxLength={2000}
            rows={4}
            hint="Two or three lines: who you are, what you're best at, and what you want next."
            onChange={(summary) => set('summary', summary, 'summary')}
            placeholder="e.g. Frontend engineer with 5 years building accessible React apps…"
          />
        );
      case 'skills':
        return (
          <SkillsForm skills={doc.skills} onChange={(skills, k) => set('skills', skills, k)} />
        );
      case 'experience':
        return (
          <ExperienceForm
            roles={doc.experience}
            flagged={flagged}
            onChange={(experience, k) => set('experience', experience, k)}
          />
        );
      case 'projects':
        return (
          <ProjectsForm
            projects={doc.projects}
            flagged={flagged}
            onChange={(projects, k) => set('projects', projects, k)}
          />
        );
      case 'education':
        return (
          <EducationForm
            entries={doc.education}
            flagged={flagged}
            onChange={(education, k) => set('education', education, k)}
          />
        );
      case 'certifications':
        return (
          <CertificationsForm
            items={doc.certifications}
            onChange={(certifications, k) => set('certifications', certifications, k)}
          />
        );
      default: {
        const section = doc.custom.find((s) => `x:${s.id}` === key);
        return section ? (
          <CustomSectionForm
            section={section}
            onChange={(next, k) =>
              change(
                (d) => ({ ...d, custom: d.custom.map((s) => (s.id === next.id ? next : s)) }),
                k,
              )
            }
          />
        ) : null;
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <SectionCard
        anchor={anchorOf('header')}
        heading="Header"
        note={headerNote(doc)}
        defaultOpen={blank}
      >
        <HeaderForm header={doc.header} onChange={(header, k) => set('header', header, k)} />
      </SectionCard>

      {doc.order.map((key, index) => {
        const custom = key.startsWith('x:');
        const standard = key as StandardSectionKey;
        return (
          <SectionCard
            key={key}
            anchor={anchorOf(key)}
            heading={sectionHeading(doc, key)}
            note={sectionNote(doc, key)}
            defaultOpen={blank || key === 'summary' || key === 'experience'}
            {...(custom ? {} : { defaultHeading: DEFAULT_SECTION_HEADING[standard] })}
            onRename={(heading) =>
              custom
                ? change(
                    (d) => ({
                      ...d,
                      custom: d.custom.map((s) =>
                        `x:${s.id}` === key ? { ...s, heading: heading.trim() || s.heading } : s,
                      ),
                    }),
                    'rename',
                  )
                : change(
                    (d) => ({ ...d, headings: { ...d.headings, [standard]: heading.trim() } }),
                    'rename',
                  )
            }
            onMove={(by) => moveSection(key, by)}
            canMoveUp={index > 0}
            canMoveDown={index < doc.order.length - 1}
            {...(custom
              ? {
                  onRemove: () =>
                    change(
                      (d) => ({
                        ...d,
                        custom: d.custom.filter((s) => `x:${s.id}` !== key),
                        order: d.order.filter((k) => k !== key),
                      }),
                      'custom.remove',
                    ),
                }
              : {})}
          >
            {body(key)}
          </SectionCard>
        );
      })}

      {doc.custom.length < 6 && (
        <Dropdown.Root>
          <Dropdown.Trigger asChild>
            <button
              type="button"
              className="flex h-control-lg items-center justify-center gap-2 rounded-xl border border-dashed border-border-default text-body-l font-semibold text-text-primary transition-colors duration-press ease-standard hover:border-neutral-400 hover:bg-surface-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <PlusIcon aria-hidden className="size-4" />
              Add a section
            </button>
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content
              align="center"
              sideOffset={6}
              className={cn(
                'z-50 min-w-[240px] rounded-md border border-border-default bg-surface-card p-1.5 shadow-popover',
                menuSurfaceMotion,
              )}
            >
              {CUSTOM_SECTION_PRESETS.filter((p) => !present.has(p.toLowerCase())).map((preset) => (
                <Dropdown.Item
                  key={preset}
                  className={menuItem}
                  onSelect={() => addSection(preset)}
                >
                  {preset}
                </Dropdown.Item>
              ))}
              <Dropdown.Separator className="my-1 h-px bg-border-faint" />
              <Dropdown.Item
                className={cn(menuItem, 'font-semibold text-text-brand')}
                onSelect={() => addSection('')}
              >
                A section with my own heading…
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      )}
    </div>
  );
}
