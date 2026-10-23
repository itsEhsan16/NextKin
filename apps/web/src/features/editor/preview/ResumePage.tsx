import {
  sectionHeading,
  type DocLine,
  type DocSectionKey,
  type ResumeDocument,
  type ResumeTemplateId,
} from '@nextkin/shared/models';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { periodText } from '../period';

/**
 * The page as the template sets it, drawn live from the editor's document (toreview §124). It
 * follows the LaTeX templates (`server/src/export/latex/styles.ts`) — the same order, headings,
 * header and entry rows, in the nearest web fonts — at US Letter's 816 px width. The PDF tab
 * shows the typeset pages themselves; this is the instant view while typing.
 */

export const PAGE_WIDTH = 816;
export const PAGE_HEIGHT = 1056;

type Look = {
  font: string;
  header: string;
  name: string;
  headline: string;
  contact: string;
  sep: string;
  heading: string;
  padding: string;
};

const LOOKS: Record<ResumeTemplateId, Look> = {
  jake: {
    font: "'Latin Modern Roman', 'CMU Serif', 'Computer Modern Serif', 'Times New Roman', serif",
    header: 'text-center',
    name: 'text-[33px] font-bold leading-tight',
    headline: 'text-[13.3px]',
    contact: 'text-[13.3px]',
    sep: ' | ',
    heading:
      'mt-[10px] mb-[5px] border-b border-neutral-800 text-[19px] [font-variant:small-caps] leading-tight',
    padding: 'px-[53px] py-[48px]',
  },
  modern: {
    font: "'TeX Gyre Heros', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    header: 'text-left',
    name: 'text-[32px] font-bold leading-tight',
    headline: 'text-[14.7px] text-brand-700',
    contact: 'text-[13.3px]',
    sep: '  •  ',
    heading:
      'mt-[10px] mb-[5px] border-b-[1.5px] border-brand-100 text-[19px] font-bold text-brand-700 leading-tight',
    padding: 'px-[53px] py-[48px]',
  },
  elegant: {
    font: "'TeX Gyre Pagella', 'Palatino Linotype', 'Book Antiqua', Palatino, serif",
    header: 'text-center',
    name: 'text-[29px] leading-tight',
    headline: 'text-[14.7px] italic',
    contact: 'text-[13.3px]',
    sep: '  ·  ',
    heading: 'mt-[10px] mb-[5px] border-b border-neutral-700 text-[19px] italic leading-tight',
    padding: 'px-[53px] py-[48px]',
  },
};

const lines = (items: DocLine[]) => items.filter((l) => l.text.trim());

function Bullets({ items }: { items: DocLine[] }) {
  const shown = lines(items);
  if (!shown.length) return null;
  return (
    <ul className="mt-[2px] list-disc pl-[30px] text-[13.3px] leading-[1.3]">
      {shown.map((l) => (
        <li key={l.id} className="mb-[1px]">
          {l.text}
        </li>
      ))}
    </ul>
  );
}

function Entry({
  title,
  right,
  subtitle,
  subRight,
  tech,
  children,
}: {
  title: ReactNode;
  right?: string;
  subtitle?: string;
  subRight?: string;
  tech?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-[5px] break-inside-avoid pl-[14px]">
      <div className="flex justify-between gap-4 text-[14.7px]">
        <span>
          <b>{title}</b>
          {tech ? <i> | {tech}</i> : null}
        </span>
        {right && <span className="shrink-0">{right}</span>}
      </div>
      {(subtitle || subRight) && (
        <div className="flex justify-between gap-4 text-[13.3px] italic">
          <span>{subtitle}</span>
          {subRight && <span className="shrink-0">{subRight}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

function body(doc: ResumeDocument, key: DocSectionKey): ReactNode {
  switch (key) {
    case 'summary':
      return doc.summary.trim() ? (
        <p className="text-[13.3px] leading-[1.35]">{doc.summary}</p>
      ) : null;
    case 'skills': {
      const groups = doc.skills.groups.filter((g) => g.label.trim() && g.skills.length);
      if (!groups.length && !doc.skills.loose.length) return null;
      return (
        <ul className="pl-[14px] text-[13.3px] leading-[1.35]">
          {groups.map((g) => (
            <li key={g.id}>
              <b>{g.label}</b>: {g.skills.join(', ')}
            </li>
          ))}
          {doc.skills.loose.length > 0 && (
            <li>
              {groups.length ? (
                <>
                  <b>Also</b>:{' '}
                </>
              ) : null}
              {doc.skills.loose.join(', ')}
            </li>
          )}
        </ul>
      );
    }
    case 'experience':
      return doc.experience.length
        ? doc.experience.map((r) => (
            <Entry
              key={r.id}
              title={r.company || 'Employer'}
              right={periodText(r.start, r.end)}
              subtitle={r.title}
              subRight={r.location}
            >
              <Bullets items={r.bullets} />
              {r.groups
                .filter((g) => g.title.trim())
                .map((g) => (
                  <Entry key={g.id} title={g.title} tech={g.tech}>
                    <Bullets items={g.bullets} />
                  </Entry>
                ))}
            </Entry>
          ))
        : null;
    case 'projects':
      return doc.projects.length
        ? doc.projects.map((p) => (
            <Entry
              key={p.id}
              title={p.name || 'Project'}
              tech={p.tech}
              right={periodText(p.start, p.end)}
              subtitle={p.description}
            >
              <Bullets items={p.bullets} />
            </Entry>
          ))
        : null;
    case 'education':
      return doc.education.length
        ? doc.education.map((e) => (
            <Entry
              key={e.id}
              title={e.institution || 'School'}
              right={periodText(e.start, e.end)}
              subtitle={[[e.degree, e.field].filter(Boolean).join(', '), e.gpa]
                .filter(Boolean)
                .join(' | ')}
              subRight={e.location}
            />
          ))
        : null;
    case 'certifications': {
      const certs = doc.certifications.filter((c) => c.name.trim());
      return certs.length ? (
        <ul className="pl-[14px] text-[13.3px] leading-[1.35]">
          {certs.map((c) => (
            <li key={c.id}>{c.issuer.trim() ? `${c.name} — ${c.issuer}` : c.name}</li>
          ))}
        </ul>
      ) : null;
    }
    default: {
      const section = doc.custom.find((s) => `x:${s.id}` === key);
      if (!section || (!section.entries.length && !lines(section.lines).length)) return null;
      return (
        <>
          {section.entries.map((e) => (
            <Entry
              key={e.id}
              title={e.title || 'Entry'}
              right={e.right}
              subtitle={e.subtitle}
              subRight={e.subRight}
            >
              <Bullets items={e.bullets} />
            </Entry>
          ))}
          {lines(section.lines).length > 0 && (
            <ul className="pl-[14px] text-[13.3px] leading-[1.35]">
              {lines(section.lines).map((l) => (
                <li key={l.id}>{l.text}</li>
              ))}
            </ul>
          )}
        </>
      );
    }
  }
}

export function ResumePage({ doc, className }: { doc: ResumeDocument; className?: string }) {
  const look = LOOKS[doc.template] ?? LOOKS.jake;
  const contact = doc.header.items.filter((i) => i.text.trim());
  return (
    <article
      aria-label="Live preview of your resume"
      style={{ fontFamily: look.font, width: PAGE_WIDTH }}
      className={cn('bg-surface-card text-neutral-800', look.padding, className)}
    >
      <header className={cn('mb-[6px]', look.header)}>
        <h1 className={look.name}>
          {doc.header.name.trim() || <span className="text-neutral-400">Your name</span>}
        </h1>
        {doc.header.headline.trim() && (
          <p className={cn('mt-[2px]', look.headline)}>{doc.header.headline}</p>
        )}
        {contact.length > 0 && (
          <p className={cn('mt-[3px]', look.contact)}>
            {contact.map((c) => c.text).join(look.sep)}
          </p>
        )}
      </header>
      {doc.order.map((key) => {
        const content = body(doc, key);
        if (!content) return null;
        return (
          <section key={key}>
            <h2 className={look.heading}>{sectionHeading(doc, key)}</h2>
            {content}
          </section>
        );
      })}
    </article>
  );
}
