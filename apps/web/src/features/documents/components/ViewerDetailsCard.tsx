import type { CareerDocument } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';
import type { ComponentType, ReactNode, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { formatCoarseAge, formatFileSize, formatUpdated } from '@/lib/format';
import { resolveLogo } from '@/ui/assets';
import {
  BriefcaseIcon,
  CalendarIcon,
  ClockIcon,
  DatabaseIcon,
  DocumentIcon,
  DownloadIcon,
  EllipsisIcon,
  LinkIcon,
} from '@/ui/icons';
import { cardPad, cardSurface } from '@/ui/Card';
import { Tag } from '@/ui/Tag';

import { FORMAT_LABEL, KIND_LABEL, KIND_TONE } from '../documentLibrary';
import { FileTypeTile } from './FileTypeTile';
import { Soon, soonControl } from '@/ui/Soon';
import { BUTTON_VARIANT } from '@/ui/buttonStyles';

const ACTION = 'h-control-lg gap-2 whitespace-nowrap rounded-md px-3 text-body-l font-semibold';

/** One of the four facts (580:193-209): a small glyph and its name over the value. */
function Fact({
  Icon,
  label,
  value,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-neutral-50 px-4 py-3">
      <dt className="flex items-center gap-1.5 text-body-s text-text-tertiary">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        {label}
      </dt>
      <dd className="mt-1 text-body-l font-medium text-text-primary">{value}</dd>
    </div>
  );
}

/** "Addressed to" and "Role" (580:221, 226): a glyph and a name, then the value. */
function LetterRow({
  glyph,
  label,
  value,
  href,
}: {
  glyph: ReactNode;
  label: string;
  value: string;
  href?: Route;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <dt className="flex w-32 shrink-0 items-center gap-2.5 text-body-m text-text-tertiary">
        {glyph}
        {label}
      </dt>
      <dd className="min-w-0 text-body-m font-medium text-text-primary">
        {href && href !== '/jobs' ? (
          <Link
            href={href}
            className="rounded-sm text-text-brand transition-colors duration-press ease-standard hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

/**
 * The viewer's details card (580:175): the file with its tags, Download, Share and more, then its
 * facts and, for a letter, who it is addressed to and for which role. Download and Share need the
 * file, which the mock doesn't hold, so they are inert, as on the Documents page (`toreview.md`
 * §95).
 */
export function ViewerDetailsCard({
  document,
  roleHref,
}: {
  document: CareerDocument;
  /** The letter's job, which its Role row opens. */
  roleHref?: Route;
}) {
  const letter = document.coverLetter;
  const renderLogo = resolveLogo(letter?.companyLogoUrl);

  return (
    <section aria-label={`${document.title} details`} className={cn(cardSurface, cardPad)}>
      <div className="rounded-md bg-neutral-50 p-5">
        <div className="flex items-center gap-3.5">
          <FileTypeTile format={document.format} size="preview" />
          <div className="min-w-0">
            <h2 className="text-h2 text-text-primary">{document.title}</h2>
            <p className="mt-0.5 text-body-s text-text-tertiary">
              {[
                FORMAT_LABEL[document.format],
                formatFileSize(document.sizeBytes),
                formatUpdated(document.updatedAt),
              ].join(' • ')}
            </p>
          </div>
        </div>
        <ul aria-label="Tags" className="mt-3.5 flex flex-wrap gap-2">
          <li>
            <Tag tone={KIND_TONE[document.kind]}>{KIND_LABEL[document.kind]}</Tag>
          </li>
          {letter && (
            <>
              <li>
                <Tag tone="brand">{letter.role}</Tag>
              </li>
              <li>
                <Tag tone="neutral">{letter.company}</Tag>
              </li>
            </>
          )}
        </ul>
      </div>

      <div className="mt-5 flex gap-2.5">
        <Soon>
          <button
            aria-disabled="true"
            type="button"
            className={cn(BUTTON_VARIANT.secondary, ACTION, 'flex-1', soonControl)}
          >
            <DownloadIcon aria-hidden className="size-4 shrink-0 text-text-secondary" />
            Download
          </button>
        </Soon>
        <Soon>
          <button
            aria-disabled="true"
            type="button"
            className={cn(BUTTON_VARIANT.secondary, ACTION, 'flex-1', soonControl)}
          >
            <LinkIcon aria-hidden className="size-4 shrink-0 text-text-secondary" />
            Share
          </button>
        </Soon>
        <Soon>
          <button
            aria-disabled="true"
            type="button"
            aria-label="More actions"
            className={cn(
              soonControl,
              BUTTON_VARIANT.secondary,
              'size-control-lg shrink-0 rounded-full',
            )}
          >
            <EllipsisIcon aria-hidden className="size-4 text-text-secondary" />
          </button>
        </Soon>
      </div>

      <h3 className="mt-6 text-title-l font-semibold text-text-primary">Details</h3>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <Fact Icon={DocumentIcon} label="Format" value={FORMAT_LABEL[document.format]} />
        <Fact Icon={DatabaseIcon} label="Size" value={formatFileSize(document.sizeBytes)} />
        <Fact Icon={CalendarIcon} label="Created" value={formatCoarseAge(document.createdAt)} />
        <Fact Icon={ClockIcon} label="Updated" value={formatCoarseAge(document.updatedAt)} />
      </dl>

      {letter && (
        <dl className="mt-3.5">
          <LetterRow
            glyph={renderLogo?.({ className: 'size-4 shrink-0' })}
            label="Addressed to"
            value={`${letter.company}, ${letter.location.split(',')[0]}`}
          />
          <LetterRow
            glyph={<BriefcaseIcon aria-hidden className="size-4 shrink-0" />}
            label="Role"
            href={roleHref}
            value={letter.jobRef ? `${letter.role} (${letter.jobRef})` : letter.role}
          />
        </dl>
      )}
    </section>
  );
}
