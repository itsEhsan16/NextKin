'use client';

import type { Resume } from '@nextkin/shared/models';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { formatUpdated } from '@/lib/format';
import { useReveal } from '@/lib/useReveal';
import { Tag } from '@/ui/Tag';
import { tabId, UnderlineTabs, type UnderlineTab } from '@/ui/UnderlineTabs';

import { VARIANT_LABEL, VARIANT_TONE } from '../resumeLibrary';
import { ResumeActions } from './ResumeActions';
import { ResumeDetailsTab } from './ResumeDetailsTab';
import { ResumeMetaRow } from './ResumeMetaRow';
import { ResumeRowMenu } from './ResumeRowMenu';
import { ResumePreviewTab } from './ResumePreviewTab';
import { ResumeScoreTab } from './ResumeScoreTab';
import { ResumeTile } from './ResumeTile';
import { ResumeVersionsTab } from './ResumeVersionsTab';

type ResumeDetailTab = 'preview' | 'details' | 'score' | 'versions';

/** The four tabs (304:3312). Only Preview is drawn with content. */
const RESUME_DETAIL_TABS: readonly UnderlineTab<ResumeDetailTab>[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'details', label: 'Details' },
  { id: 'score', label: 'ATS Score' },
  { id: 'versions', label: 'Version History' },
];

/**
 * The selected document's card (304:3258), in the board's order: tile, title and when it changed,
 * its type and the kebab; the meta line; the three actions; the tabs. `ResumeDetailPanel` keys it
 * by document, so switching documents goes back to Preview.
 */
export function ResumeDetailCard({
  resume,
  reveal = false,
  onDuplicated,
}: {
  resume: Resume;
  reveal?: boolean;
  onDuplicated?: (id: string) => void;
}) {
  const [tab, setTab] = useState<ResumeDetailTab>('preview');
  const switched = useReveal(true, tab);
  const panel = `resume-${resume.id}-panel`;

  return (
    <section
      aria-label={resume.title}
      // The frame stays put; its contents fade in when they replace a skeleton or another resume.
      className={cn('flex min-h-0 flex-1 flex-col', reveal && '*:animate-reveal')}
    >
      <div className="flex shrink-0 items-start gap-4">
        <ResumeTile accent={resume.accent} size="card" />
        {/* One line for the title, cut short when long (the whole of it on hover), so the type
            stays beside it and the card keeps its height. */}
        <div className="min-w-0 flex-1">
          <h2 title={resume.title} className="truncate text-h2 font-semibold text-text-primary">
            {resume.title}
          </h2>
          <p className="mt-1 text-body-m text-text-tertiary">{formatUpdated(resume.updatedAt)}</p>
        </div>
        {resume.variant && (
          <Tag tone={VARIANT_TONE[resume.variant]} shape="pill" className="mt-1 shrink-0">
            {VARIANT_LABEL[resume.variant]}
          </Tag>
        )}
        {/* The rows' menu, so the card's kebab does what theirs does (toreview §131). */}
        <ResumeRowMenu resume={resume} context="card" {...(onDuplicated ? { onDuplicated } : {})} />
      </div>

      <ResumeMetaRow resume={resume} className="mt-4 shrink-0" />
      <ResumeActions resume={resume} className="mt-5 shrink-0" />

      <UnderlineTabs
        tabs={RESUME_DETAIL_TABS}
        active={tab}
        onChange={setTab}
        label="Resume detail"
        idBase={panel}
        // Narrower than the four tabs (a 768 window), the bar scrolls sideways inside the card.
        className="mt-6 shrink-0 overflow-x-auto scrollbar-thin"
      />

      {/* Keyed by tab: after the first switch, each tab's content fades in (`toreview.md` §84). */}
      <div
        key={tab}
        id={panel}
        role="tabpanel"
        aria-labelledby={tabId(panel, tab)}
        // The card's one scroller; 8px wider either side so the preview's shadow isn't clipped.
        className={cn(
          '-mx-2 min-h-0 flex-1 overflow-y-auto px-2 pt-5 scrollbar-thin',
          switched && 'animate-reveal',
        )}
      >
        {tab === 'preview' && <ResumePreviewTab resume={resume} />}
        {tab === 'details' && <ResumeDetailsTab resume={resume} />}
        {tab === 'score' && <ResumeScoreTab resume={resume} />}
        {tab === 'versions' && <ResumeVersionsTab resume={resume} />}
      </div>
    </section>
  );
}
