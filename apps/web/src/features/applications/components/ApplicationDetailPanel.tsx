'use client';

import type { ApplicationStatus, ApplicationWithJob } from '@nextkin/shared/models';
import Link from 'next/link';
import { useState } from 'react';

import { JobMetaRow } from '@/features/jobs/components/JobMetaRow';
import { jobHref } from '@/features/jobs/jobHref';
import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { AiCallout } from '@/ui/AiCallout';
import { CompanyLogo } from '@/ui/CompanyLogo';
import { DetailCardSkeleton } from '@/ui/DetailCardSkeleton';
import { StateView } from '@/ui/StateView';
import { EmptyStateArt } from '@/ui/illustrations';
import { UnderlineTabs, type UnderlineTab } from '@/ui/UnderlineTabs';
import { iconButton } from '@/ui/iconButton';
import { HugeArrowRight, HugeMoreVertical } from '@/ui/hugeIcons';

import { stageOf } from '../applicationStage';
import { ApplicationOverviewTab } from './ApplicationOverviewTab';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';
import { ApplicationSubmissionTab } from './ApplicationSubmissionTab';
import { UpdateStatusMenu } from './UpdateStatusMenu';
import { cardSurface, cardSurfaceLoading } from '@/ui/Card';
import { Soon, soonControl } from '@/ui/Soon';
import { BUTTON_VARIANT } from '@/ui/buttonStyles';

type ApplicationDetailTab = 'overview' | 'application' | 'follow-ups' | 'notes';

/** The four tabs (286:1584). Only Overview is drawn with content. */
const APPLICATION_DETAIL_TABS: readonly UnderlineTab<ApplicationDetailTab>[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'application', label: 'Application' },
  // Drawn on the board (286:1584) with no model behind them yet: they say so (AP-05).
  { id: 'follow-ups', label: 'Follow-ups', soon: true },
  { id: 'notes', label: 'Notes', soon: true },
];

export type ApplicationDetailPanelProps = {
  row?: ApplicationWithJob;
  /** `'empty'`: nothing to show — no application picked, or none at all (`hasAny`). */
  status: 'pending' | 'error' | 'success' | 'empty';
  hasAny: boolean;
  onRetry: () => void;
  onUpdateStatus: (status: ApplicationStatus) => void;
  /** A status change is being saved. */
  saving?: boolean;
};

/** The card surface every state shares — the Jobs detail card's. */
const CARD = cardSurface;

/** The right column (286:1550), in the same four states as the Jobs detail card. */
export function ApplicationDetailPanel({
  row,
  status,
  hasAny,
  onRetry,
  onUpdateStatus,
  saving = false,
}: ApplicationDetailPanelProps) {
  const reveal = useReveal(status === 'success', row?.application.id);

  if (status === 'empty') {
    return (
      <div className={cn(CARD, 'p-6')}>
        {hasAny ? (
          <StateView
            art={<EmptyStateArt object="notebook" />}
            title="Select an application"
            message="Choose one from the list to see where it stands."
          />
        ) : (
          <StateView
            art={<EmptyStateArt object="briefcase" />}
            title="Nothing to track yet"
            message="Apply to a job and it will show here."
          />
        )}
      </div>
    );
  }

  if (status === 'pending') {
    return (
      // Shrinks to the column and clips, as the loaded card does on a short window.
      <div className={cn(cardSurfaceLoading, 'min-h-0 overflow-hidden p-6')}>
        <DetailCardSkeleton lines={11} />
      </div>
    );
  }

  if (status === 'error' || !row) {
    return (
      <div className={cn(CARD, 'p-6')}>
        <StateView
          tone="danger"
          title="Couldn't load this application"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={onRetry}
        />
      </div>
    );
  }

  // Keyed so switching applications resets to Overview and the card's scroll to the top.
  return (
    <ApplicationDetailBody
      key={row.application.id}
      row={row}
      reveal={reveal}
      onUpdateStatus={onUpdateStatus}
      saving={saving}
    />
  );
}

/**
 * The whole card, in the board's order (286:1550): the listing's header with where the
 * application stands, "View Job" and "Update Status" straight under its meta line, as on the Jobs
 * card, then the tabs and the interview callout. Like the Jobs card it keeps its natural height
 * and scrolls as one unit only when the window is shorter than it.
 */
function ApplicationDetailBody({
  row,
  reveal,
  onUpdateStatus,
  saving,
}: {
  row: ApplicationWithJob;
  /** Fade the card's contents in: they replace a skeleton, or another application's details. */
  reveal: boolean;
  onUpdateStatus: (status: ApplicationStatus) => void;
  saving: boolean;
}) {
  const [tab, setTab] = useState<ApplicationDetailTab>('overview');
  const switched = useReveal(true, tab);
  const { application, job } = row;
  const stage = stageOf(row);

  return (
    <section
      aria-label={`${job.title} at ${job.company}`}
      // The frame stays put; its contents fade in (`toreview.md` §84).
      className={cn(
        CARD,
        'min-h-0 overflow-y-auto p-6 [scrollbar-width:thin]',
        reveal && '*:animate-reveal',
      )}
    >
      <div className="flex items-start justify-between">
        <CompanyLogo company={job.company} logoUrl={job.companyLogoUrl} variant="plain" />
        <div className="-mr-2 flex items-center gap-1">
          <ApplicationStatusBadge stage={stage} />
          <Soon>
            <button
              aria-disabled="true"
              type="button"
              aria-label="More options"
              className={cn(iconButton, 'text-text-tertiary hover:text-text-primary', soonControl)}
            >
              <HugeMoreVertical className="size-4" />
            </button>
          </Soon>
        </div>
      </div>

      <h2 className="mt-4 text-h1 text-text-primary">{job.title}</h2>
      <p className="mt-1 text-body-m text-text-company">{job.company}</p>
      <JobMetaRow job={job} className="mt-3" />

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link
          href={jobHref(job.id)}
          className={cn(
            BUTTON_VARIANT.primary,
            'h-control-lg gap-2 rounded-md text-body-l font-semibold',
          )}
        >
          View Job
          {/* An app page, not a new tab (AP-12). */}
          <HugeArrowRight className="size-4" />
        </Link>
        <UpdateStatusMenu status={application.status} onChange={onUpdateStatus} saving={saving} />
      </div>

      <UnderlineTabs
        tabs={APPLICATION_DETAIL_TABS}
        active={tab}
        onChange={setTab}
        label="Application detail"
        className="mt-6"
      />

      {/* Keyed by tab: after the first switch, each tab's content fades in (`toreview.md` §84). */}
      <div key={tab} className={cn('pt-5', switched && 'animate-reveal')}>
        {tab === 'overview' && <ApplicationOverviewTab row={row} stage={stage} />}
        {tab === 'application' && <ApplicationSubmissionTab row={row} stage={stage} />}
        {/* Follow-ups and notes have no field in the model yet: application tracking is Release 2
            (V2 §6.2). The same honest empty surface as the Jobs card's undrawn tabs. */}
        {tab === 'follow-ups' && (
          <StateView
            title="No follow-ups yet"
            message="Reminders to follow up on this application will show here."
            className="py-8"
          />
        )}
        {tab === 'notes' && (
          <StateView
            title="No notes yet"
            message="Notes you keep about this application will show here."
            className="py-8"
          />
        )}
      </div>

      {/* "Prepare for your interview" (286:1660) goes to Interview Prep, which is where
          AI-generated questions for a role live. Only while an interview is ahead (AP-09): not
          on an offer, a rejection or a withdrawn application. */}
      {(stage === 'in_review' || stage === 'interview') && (
        <div className="mt-6">
          <AiCallout
            tone="muted"
            title="Prepare for your interview"
            message="Get AI-powered interview questions for this role."
            href="/interview"
          />
        </div>
      )}
    </section>
  );
}
