'use client';

import type { Resume } from '@nextkin/shared/models';
import { useResumeVersions } from '@nextkin/shared/queries';

import { formatShortDate } from '@/lib/format';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Tag } from '@/ui/Tag';

/**
 * The Version History tab, which the board names (304:3319) but never opens: every version V2
 * §7.11 keeps, newest first, with what changed and when. Read-only for now; restoring one is the
 * editor's job, and the editor has no artboard yet.
 */
export function ResumeVersionsTab({ resume }: { resume: Resume }) {
  const versions = useResumeVersions(resume.id);

  if (versions.isPending) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-14 rounded-md" />
        ))}
      </div>
    );
  }

  // Data first: past the skeleton, only a load with nothing to show is an error. A failed
  // background refresh keeps what is on screen (`toreview.md` §84).
  if (versions.data === undefined) {
    return (
      <StateView
        tone="danger"
        title="Couldn't load the history"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void versions.refetch()}
        className="py-8"
      />
    );
  }

  if (versions.data.length === 0) {
    return (
      <StateView
        title="No versions yet"
        message="Each saved change will show up here."
        className="py-8"
      />
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {versions.data.map((version) => (
        <li
          key={version.id}
          className="flex items-center justify-between gap-3 rounded-md border border-border-card px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-body-m font-semibold text-neutral-800">
              <span>Version {version.version}</span>
              {version.id === resume.currentVersionId && <Tag tone="brand">Current</Tag>}
            </p>
            {version.changeNote && (
              <p className="truncate text-body-s text-text-tertiary">{version.changeNote}</p>
            )}
          </div>
          <p className="shrink-0 text-body-s text-neutral-400">
            {formatShortDate(version.createdAt)}
          </p>
        </li>
      ))}
    </ol>
  );
}
