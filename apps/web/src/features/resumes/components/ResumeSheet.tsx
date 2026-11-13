import { RESUME_SECTION_LABEL, type ContentRole, type ResumeContent } from '@nextkin/shared/models';
import type { ComponentType, ReactNode, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { CompanyLogo } from '@/ui/CompanyLogo';
import { LinkIcon, LocationOutlineIcon, PhoneIcon } from '@/ui/icons';
import { Mail01 } from '@/ui/lineIcons';

type ContactItem = { key: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; label: string };

/** A glyph for one item of a file's own contact row, by what it looks like. */
function iconFor(text: string): ContactItem['Icon'] {
  if (/@/.test(text) && !/\s/.test(text.trim())) return Mail01;
  if (/^\+?[\d\s().-]{7,}$/.test(text.trim())) return PhoneIcon;
  if (/^(https?:\/\/|www\.)|\.(com|in|io|dev|me|org|net)(\/|$)|linkedin|github/i.test(text))
    return LinkIcon;
  return LocationOutlineIcon;
}

/**
 * The document itself, as the Preview tab draws it (304:3321): the name and the line under it, the
 * contact details, then each section the body has, in the order the export prints them. The board
 * shows a summary and two roles; the other sections appear only when a body has them.
 */
export function ResumeSheet({
  name,
  body,
  className,
}: {
  name: string;
  body: ResumeContent;
  /** Replaces the bordered frame: the Resumes card draws the sheet as a page on a muted tile. */
  className?: string;
}) {
  const { email, phone, location } = body.contact ?? {};
  // The resume's own header wins (toreview §137): a tailored or uploaded resume shows the name and
  // contacts its file printed, not the signed-in account's.
  const contact: ContactItem[] = body.header
    ? body.header.items.map((item, i) => ({
        key: `${i}-${item.text}`,
        Icon: iconFor(item.text),
        label: item.text,
      }))
    : [
        ...(email ? [{ key: 'email', Icon: Mail01, label: email }] : []),
        ...(phone ? [{ key: 'phone', Icon: PhoneIcon, label: phone }] : []),
        ...(location ? [{ key: 'location', Icon: LocationOutlineIcon, label: location }] : []),
        ...(body.links ?? []).map((link) => ({ key: link, Icon: LinkIcon, label: link })),
      ];
  const shownName = body.header?.name ?? name;

  return (
    <div className={cn('rounded-md border border-border-default px-4 pb-4 pt-5', className)}>
      <h3 className="text-h2 text-text-primary">{shownName}</h3>
      {body.headline && (
        <p className="mt-0.5 text-body-m font-semibold text-text-secondary">{body.headline}</p>
      )}
      {contact.length > 0 && (
        <ul
          aria-label="Contact details"
          className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-caption-m text-text-tertiary"
        >
          {contact.map(({ key, Icon, label }) => (
            <li key={key} className="flex items-center gap-1.5">
              <Icon className="size-3.5 shrink-0" />
              {label}
            </li>
          ))}
        </ul>
      )}

      {body.summary && (
        <SheetSection title="Summary">
          <p className="text-body-s text-text-tertiary">{body.summary}</p>
        </SheetSection>
      )}
      {body.skills.length > 0 && (
        <SheetSection title="Skills">
          <p className="text-body-s text-text-tertiary">{body.skills.join(' · ')}</p>
        </SheetSection>
      )}
      {/* The printed heading (toreview §159, §167): "Work Experience", as the PDF says it. */}
      {body.experience.length > 0 && (
        <SheetSection title={RESUME_SECTION_LABEL.experience}>
          <ol className="flex flex-col gap-4">
            {body.experience.map((role) => (
              <SheetRole key={role.id} role={role} />
            ))}
          </ol>
        </SheetSection>
      )}
      {body.projects.length > 0 && (
        <SheetSection title="Projects">
          <ul className="flex flex-col gap-3">
            {body.projects.map((project) => (
              <li key={project.id}>
                <p className="text-body-s font-bold text-text-primary">{project.name}</p>
                <p className="text-body-s text-text-tertiary">{project.description}</p>
                <Bullets items={project.bullets} />
              </li>
            ))}
          </ul>
        </SheetSection>
      )}
      {body.education.length > 0 && (
        <SheetSection title="Education">
          <ul className="flex flex-col gap-2">
            {body.education.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-body-s font-bold text-text-primary">{entry.degree}</p>
                  <p className="text-micro font-semibold text-text-tertiary">{entry.institution}</p>
                </div>
                <p className="shrink-0 text-caption-m text-text-tertiary">{entry.period}</p>
              </li>
            ))}
          </ul>
        </SheetSection>
      )}
      {body.certifications.length > 0 && (
        <SheetSection title="Certifications">
          <p className="text-body-s text-text-tertiary">{body.certifications.join(' · ')}</p>
        </SheetSection>
      )}
    </div>
  );
}

function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h4 className="mb-1.5 text-body-m font-bold text-text-primary">{title}</h4>
      {children}
    </section>
  );
}

/** One role (304:3353): the employer's mark, title, employer and place, the dates, the bullets. */
function SheetRole({ role }: { role: ContentRole }) {
  return (
    <li className="flex gap-3">
      <div className="pt-0.5">
        <CompanyLogo company={role.company} logoUrl={role.companyLogoUrl} variant="inline" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-s font-bold text-text-primary">{role.title}</p>
            <p className="text-micro font-semibold text-text-tertiary">
              {[role.company, role.location].filter(Boolean).join(' • ')}
            </p>
          </div>
          <p className="shrink-0 text-caption-m text-text-tertiary">{role.period}</p>
        </div>
        <Bullets items={role.bullets} />
      </div>
    </li>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-1.5 list-disc pl-3.5 text-body-s text-text-tertiary marker:text-neutral-400">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
