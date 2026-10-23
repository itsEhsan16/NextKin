'use client';

import { useResumePreview } from '@nextkin/shared/queries';
import { useState } from 'react';

import { PageImages } from '@/features/resumes/components/PageImages';
import { SegmentedControl } from '@/ui/SegmentedControl';

import type { LetterDraft } from '../useLetterDraft';
import { LetterPage } from './LetterPage';

/**
 * EDIT 04's preview (867:636): "Live preview" redraws the letter as it is typed; "PDF pages"
 * shows the typeset pages of the last save when the server has them, and otherwise the same page,
 * because a letter prints as drawn.
 */
export function LetterPreview({
  id,
  versionId,
  name,
  contact,
  draft,
}: {
  id: string;
  versionId: string | undefined;
  name: string;
  contact: string;
  draft: LetterDraft;
}) {
  const [tab, setTab] = useState<'live' | 'pdf'>('live');
  const preview = useResumePreview(tab === 'pdf' ? id : '', versionId);
  const pages = tab === 'pdf' ? (preview.data?.pages ?? []) : [];

  return (
    <section
      aria-label="Letter preview"
      className="flex min-h-[70vh] flex-col overflow-hidden rounded-xl border border-border-default bg-neutral-100 shadow-card lg:sticky lg:top-4"
    >
      <div className="flex shrink-0 items-center border-b border-border-default bg-surface-card px-3.5 py-3">
        <SegmentedControl
          label="Preview mode"
          value={tab}
          onChange={setTab}
          segments={[
            { id: 'live', label: 'Live preview' },
            { id: 'pdf', label: 'PDF pages' },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 px-6 pt-5">
        {pages.length > 0 ? (
          <PageImages pages={pages} stale={Boolean(preview.data?.stale)} />
        ) : (
          <div className="mx-auto max-w-2xl bg-surface-card px-12 pb-16 pt-14 shadow-popover">
            <LetterPage
              name={name}
              contact={contact}
              date={new Date()}
              greeting={draft.greeting}
              paragraphs={draft.paragraphs}
              signoff={draft.signoff}
            />
          </div>
        )}
      </div>
    </section>
  );
}
