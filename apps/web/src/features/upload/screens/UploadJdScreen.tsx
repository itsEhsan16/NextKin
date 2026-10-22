'use client';

import { cn } from '@/lib/cn';
import { PageHeader } from '@/navigation/PageHeader';
import { pageFrameInBar } from '@/ui/pageFrame';

import { JobInput } from '../components/JobInput';
import { PasteAside } from '../components/UploadAsides';
import type { AnalyzeIntent } from '../useAnalyzeAndOpen';

/**
 * Add a job (toreview §114, owner 2026-10-19): one box for the description, its link or a file,
 * then straight to tailoring. It replaces the board's three tabs (247:2 paste, 244:467 link,
 * 247:453 file), which made the first step three decisions; the paste board's column stays beside it.
 */
export function UploadJdScreen({ intent = 'tailor' }: { intent?: AnalyzeIntent }) {
  return (
    <div className={cn(pageFrameInBar, 'flex flex-col gap-4 pb-8')}>
      {/* The way back to Jobs is on the top bar's left (`toreview.md` §26, §28). */}
      {intent === 'build' ? (
        <PageHeader
          title="Build a resume for a job"
          subtitle="Paste the job description and we’ll write a new resume for it from your profile."
        />
      ) : (
        <PageHeader
          title="Tailor your resume to a job"
          subtitle="Paste the job description and we’ll show how your resume matches, then tailor it."
        />
      )}
      <div className="@container">
        <div className="grid gap-4 @min-[56rem]:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]">
          <section
            aria-label="Add a job description"
            className="flex min-w-0 flex-col rounded-lg border border-border-card bg-surface-card p-5"
          >
            <JobInput intent={intent} />
          </section>
          <PasteAside />
        </div>
      </div>
    </div>
  );
}
