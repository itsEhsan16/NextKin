'use client';

import type { ResumeSyncChanges, ResumeSyncStatus } from '@nextkin/shared/models';
import { qk, useDecideResumeSync, useResumeSync } from '@nextkin/shared/queries';
import { useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ComponentType } from 'react';

import { showToast } from '@/lib/toast';
import { Button } from '@/ui/Button';
import { Dialog, DialogDescription, DialogTitle } from '@/ui/Dialog';
import {
  BriefcaseIcon,
  DocumentIcon,
  LayersIcon,
  LinkIcon,
  PersonIcon,
  SchoolIcon,
  ShieldCheckIcon,
  StarIcon,
} from '@/ui/icons';

type Icon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const FIELD_LABEL: Record<ResumeSyncChanges['fields'][number], string> = {
  headline: 'headline',
  summary: 'summary',
  phone: 'phone',
  location: 'location',
  years: 'years of experience',
};

/** "Phone, location and summary". */
const listed = (words: string[]) =>
  words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;

/** One row per kind of change, in the order the profile shows them. Kinds with nothing are left out. */
export function changeRows(changes: ResumeSyncChanges): { Icon: Icon; label: string }[] {
  const rows: { Icon: Icon; label: string }[] = [];
  if (changes.roles) rows.push({ Icon: BriefcaseIcon, label: plural(changes.roles, 'new role') });
  if (changes.updates)
    rows.push({
      Icon: LayersIcon,
      label: `More detail on ${plural(changes.updates, 'entry', 'entries')}`,
    });
  if (changes.skills) rows.push({ Icon: StarIcon, label: plural(changes.skills, 'new skill') });
  if (changes.education)
    rows.push({ Icon: SchoolIcon, label: plural(changes.education, 'school') });
  if (changes.certifications)
    rows.push({ Icon: DocumentIcon, label: plural(changes.certifications, 'certification') });
  if (changes.projects)
    rows.push({ Icon: DocumentIcon, label: plural(changes.projects, 'project') });
  if (changes.links) rows.push({ Icon: LinkIcon, label: plural(changes.links, 'link') });
  if (changes.fields.length) {
    const words = listed(changes.fields.map((field) => FIELD_LABEL[field]));
    rows.push({ Icon: PersonIcon, label: words.charAt(0).toUpperCase() + words.slice(1) });
  }
  return rows;
}

/** Where the question waits: mid-edit or mid-run, the person is busy with the resume itself. */
const busy = (path: string) => /^\/resumes\/[^/]+\/edit/.test(path) || path.startsWith('/create');

/**
 * The profile, kept filled from the base resume. In the app shell, so it works wherever the person
 * is when the resume changes.
 *
 * The first time there is a base resume to read, the profile is filled without asking and a toast
 * says so. After that, each new version of the base resume that holds something the profile
 * doesn't raises one question, "Add it to your profile?": Yes fills it, No is remembered for that
 * version. Neither ever overwrites what the person typed (the server only fills blanks and adds).
 */
export function ResumeSyncHost() {
  const pathname = usePathname() ?? '';
  const queryClient = useQueryClient();
  const sync = useResumeSync();
  const decide = useDecideResumeSync();
  const filling = useRef<string | null>(null);

  // A resume saved, imported or made the base anywhere moves the status: read it again.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey;
      if (event.type !== 'updated' || event.action.type !== 'success' || key[0] !== 'resumes')
        return;
      clearTimeout(timer);
      timer = setTimeout(
        () => void queryClient.invalidateQueries({ queryKey: qk.profile.resumeSync() }),
        600,
      );
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [queryClient]);

  // Leaving the editor or a run is when a held question gets its turn.
  const wasBusy = useRef(busy(pathname));
  useEffect(() => {
    const now = busy(pathname);
    if (wasBusy.current && !now)
      void queryClient.invalidateQueries({ queryKey: qk.profile.resumeSync() });
    wasBusy.current = now;
  }, [pathname, queryClient]);

  const status = sync.data;
  const { mutate } = decide;
  useEffect(() => {
    if (status?.state !== 'first' || !status.versionId || filling.current === status.versionId)
      return;
    filling.current = status.versionId;
    const title = status.resumeTitle;
    mutate(
      { versionId: status.versionId, accept: true },
      {
        onSuccess: () =>
          showToast(
            title
              ? `Your profile is filled in from “${title}”.`
              : 'Your profile is filled in from your resume.',
            { tone: 'success', action: { label: 'View profile', href: '/profile' as Route } },
          ),
      },
    );
  }, [status, mutate]);

  // Escape or the backdrop sets the question aside for this visit: "not now" is not a no.
  const [setAside, setSetAside] = useState<string | null>(null);
  const asking =
    status?.state === 'changed' &&
    status.versionId &&
    !busy(pathname) &&
    setAside !== status.versionId
      ? status
      : null;
  // The words stay put while the dialog animates out.
  const [shown, setShown] = useState<ResumeSyncStatus | null>(null);
  if (asking && asking !== shown) setShown(asking);

  const answer = (accept: boolean) => {
    const versionId = asking?.versionId;
    if (!versionId) return;
    mutate(
      { versionId, accept },
      {
        onSuccess: () => {
          if (accept)
            showToast('Your profile is up to date with your resume.', {
              tone: 'success',
              action: { label: 'View profile', href: '/profile' as Route },
            });
        },
        onError: () => showToast('That didn’t save. Try again.', { tone: 'error' }),
      },
    );
  };

  const rows = shown?.changes ? changeRows(shown.changes) : [];

  return (
    <Dialog
      open={asking !== null}
      onOpenChange={(next) => {
        if (!next && !decide.isPending && asking?.versionId) setSetAside(asking.versionId);
      }}
      size="md"
    >
      <div className="flex min-h-0 flex-col overflow-y-auto">
        <div className="relative flex justify-center bg-linear-to-br from-brand-50 via-surface-raised to-brand-100 px-6 pt-6">
          <Image
            src="/illustrations/v2/profile.webp"
            alt=""
            width={470}
            height={560}
            priority
            className="h-40 w-auto object-contain max-sm:h-28"
          />
        </div>
        <div className="flex flex-col gap-3 px-6.5 pb-5 pt-5">
          <DialogTitle className="text-h2 font-bold text-text-primary">
            Add your resume updates to your profile?
          </DialogTitle>
          <DialogDescription className="text-body-l text-text-secondary">
            {shown?.resumeTitle ? (
              <>
                <span className="font-semibold text-text-primary">{shown.resumeTitle}</span> has
                something your profile doesn’t.
              </>
            ) : (
              'Your resume has something your profile doesn’t.'
            )}{' '}
            Job matches and the resumes you build read your profile.
          </DialogDescription>
          {rows.length > 0 && (
            <ul
              aria-label="What would be added"
              className="grid grid-cols-2 gap-2 max-sm:grid-cols-1"
            >
              {rows.map(({ Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-2.5 rounded-lg bg-neutral-50 px-3 py-2.5 text-body-m font-semibold text-text-primary"
                >
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-card text-text-brand"
                  >
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          )}
          <p className="flex items-center gap-2 text-body-m font-medium text-success-text">
            <ShieldCheckIcon aria-hidden className="size-4 shrink-0 text-success-600" />
            Nothing you’ve typed is changed. We only add and fill blanks.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2.5 border-t border-border-default pb-4 pl-6 pr-5 pt-3.5">
        <Button
          variant="secondary"
          size="lg"
          disabled={decide.isPending}
          onClick={() => answer(false)}
        >
          No
        </Button>
        <Button
          size="lg"
          loading={decide.isPending && decide.variables?.accept === true}
          busyLabel="Adding…"
          disabled={decide.isPending}
          onClick={() => answer(true)}
        >
          Yes, add them
        </Button>
      </div>
    </Dialog>
  );
}
