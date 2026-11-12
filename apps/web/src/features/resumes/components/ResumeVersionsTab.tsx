'use client';

import type { Resume, ResumeVersion, VersionChange } from '@nextkin/shared/models';
import { useRestoreVersion, useResumeVersions, useVersionChanges } from '@nextkin/shared/queries';
import type { Route } from 'next';
import Link from 'next/link';
import { useId, useState, type ComponentType, type SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { formatShortDate } from '@/lib/format';
import { showToast } from '@/lib/toast';
import { buttonClass } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { ClockIcon } from '@/ui/icons';
import { CheckCircle, ChevronRight, Edit03, Lock01, Stars02, Upload01 } from '@/ui/lineIcons';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Tag } from '@/ui/Tag';

type Actor = NonNullable<ResumeVersion['actor']>;

/** Who made a version (V2 §7.11 records the actor), so an AI edit is never mistaken for yours. */
const ACTOR: Record<Actor, { label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  generation: { label: 'AI', Icon: Stars02 },
  user: { label: 'You edited', Icon: Edit03 },
  restore: { label: 'Restored', Icon: ClockIcon },
  zero_review: { label: 'You reviewed', Icon: CheckCircle },
  upload: { label: 'Uploaded', Icon: Upload01 },
};

const CHANGE_MARK: Record<VersionChange['kind'], string> = {
  added: '+ Added',
  removed: '− Removed',
  reworded: 'Reworded',
};

/**
 * The Version History tab, which the board names (304:3319) but never opens: every version V2
 * §7.11 keeps, newest first (redesign R6b, audit RS-41…44).
 * - Each says who made it: an AI version is marked as one (RS-42, Jobright's "See what's changed"
 *   without the score brag).
 * - An older version opens to what it changed, line by line with why, and can be restored: the
 *   restore becomes a new version, so nothing is lost (RS-41, V2 §7.11).
 * - A version older than the plan keeps is listed, locked, not deleted (RS-43, V2 §13).
 */
export function ResumeVersionsTab({
  resume,
  canRestore = true,
}: {
  resume: Resume;
  /**
   * Off in the editor, whose unsaved typing a restore would overwrite: there it lists who made
   * each version and what changed, and restoring happens from Resumes.
   */
  canRestore?: boolean;
}) {
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

  const latest = Math.max(...versions.data.map((version) => version.version));
  return (
    <ol className="flex flex-col gap-2">
      {versions.data.map((version) => (
        <VersionRow
          key={version.id}
          resume={resume}
          version={version}
          current={version.id === resume.currentVersionId}
          next={latest + 1}
          canRestore={canRestore}
        />
      ))}
    </ol>
  );
}

function VersionRow({
  resume,
  version,
  current,
  next,
  canRestore,
}: {
  resume: Resume;
  version: ResumeVersion;
  current: boolean;
  canRestore: boolean;
  /** The number a restore would take. */
  next: number;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const restore = useRestoreVersion(resume.id);
  const bodyId = useId();
  const actor = version.actor ? ACTOR[version.actor] : undefined;
  const opens = !current && !version.locked;

  const heading = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-2 text-body-m font-semibold text-text-primary">
          Version {version.version}
          {current && <Tag tone="brand">Current</Tag>}
          {actor && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-caption-m font-medium text-text-secondary">
              <actor.Icon aria-hidden className="size-3.5 shrink-0" />
              {actor.label}
            </span>
          )}
        </span>
        {version.changeNote && (
          <span
            className={cn('text-body-s font-normal text-text-tertiary', !open && 'line-clamp-1')}
          >
            {version.changeNote}
          </span>
        )}
      </span>
      <span className="shrink-0 text-body-s font-normal text-text-tertiary">
        {formatShortDate(version.createdAt)}
      </span>
    </>
  );

  return (
    <li className={cn('rounded-md bg-surface-subtle', version.locked && 'opacity-70')}>
      {opens ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((was) => !was)}
          className="flex w-full items-center gap-4 rounded-md px-4 py-3 text-left transition-colors duration-press ease-standard hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          {heading}
          <ChevronRight
            aria-hidden
            className={cn(
              'size-4 shrink-0 text-text-tertiary transition-transform duration-fast ease-standard',
              open && 'rotate-90',
            )}
          />
        </button>
      ) : (
        <div className="flex items-center gap-4 px-4 py-3">{heading}</div>
      )}

      {version.locked && (
        <p className="flex items-center gap-1.5 px-4 pb-3 text-body-s text-text-secondary">
          <Lock01 aria-hidden className="size-4 shrink-0" />
          Pro keeps every version.
          <Link
            href={'/upgrade' as Route}
            className="font-semibold text-text-paid underline-offset-2 hover:underline"
          >
            Upgrade
          </Link>
        </p>
      )}

      {opens && open && (
        <div id={bodyId} className="animate-reveal px-4 pb-4">
          <VersionChanges resumeId={resume.id} versionId={version.id} />
          {canRestore && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={cn(buttonClass({ variant: 'secondary', size: 'sm' }), 'mt-3')}
            >
              Restore this version
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        tone="brand"
        title={`Restore version ${version.version}?`}
        message={`It becomes version ${next}. Nothing is lost: every version stays here.`}
        confirmLabel="Restore"
        busyLabel="Restoring…"
        busy={restore.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          restore.mutate(version.id, {
            onSuccess: () => {
              setConfirming(false);
              setOpen(false);
              showToast(`Restored as version ${next}`);
            },
            onError: () => {
              setConfirming(false);
              showToast("Couldn't restore that version. Try again.", { tone: 'error' });
            },
          })
        }
      />
    </li>
  );
}

/** What a version changed, where, and why (toreview §146.5). */
function VersionChanges({ resumeId, versionId }: { resumeId: string; versionId: string }) {
  const changes = useVersionChanges(resumeId, versionId);
  if (changes.isPending) return <Skeleton className="h-10 w-full rounded-md" />;
  if (!changes.data?.length) {
    return (
      <p className="text-body-s text-text-tertiary">No line-by-line record for this version.</p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {changes.data.map((change, index) => (
        <li key={`${change.where}-${index}`} className="text-body-s">
          <p className="text-text-primary">
            <span className="font-semibold">{CHANGE_MARK[change.kind]}</span> · {change.where}
          </p>
          <p className="text-text-secondary">
            {change.kind === 'reworded' && change.before ? (
              <>
                <span className="line-through">{change.before}</span> → {change.text}
              </>
            ) : (
              change.text
            )}
          </p>
          <p className="text-text-tertiary">{change.why}</p>
        </li>
      ))}
    </ul>
  );
}
