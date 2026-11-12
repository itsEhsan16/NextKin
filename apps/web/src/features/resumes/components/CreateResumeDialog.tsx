'use client';

import { useCreateResume, useCurrentUser, useProfile } from '@nextkin/shared/queries';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/Dialog';
import type { Route } from 'next';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { useGuardedRouter } from '@/navigation/guardedRouter';
import { backButton, primaryButton } from '@/features/create/jobFlow/FlowChrome';
import { Radio, rowSurface } from '@/features/create/jobFlow/FlowRows';
import { DropZone } from '@/features/tailor/flow/ResumeStep';
import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { iconButton } from '@/ui/iconButton';
import { ArrowRight, ChevronRight, XClose } from '@/ui/lineIcons';
import {
  JdArtUploadFileIllustration,
  NavDocumentsIllustration,
  ProfileExperienceIllustration,
  ProfilePaperPlaneIllustration,
  SparkleIllustration,
} from '@/ui/illustrations';
import { StableLabel } from '@/ui/StableLabel';

import { resumeEditorHref } from '../resumeHref';
import { BuildFromProfile } from './BuildFromProfile';

type Way = 'tailor' | 'build' | 'upload' | 'scratch';
type Step = 'choose' | 'upload' | 'build';

const WAYS: { key: Way; title: string; detail: string; art: ReactNode }[] = [
  {
    key: 'tailor',
    title: 'Tailor to a job',
    detail: 'Pick a job, then we compare your resume and aim it at that job.',
    art: <ProfilePaperPlaneIllustration className="h-auto w-11" />,
  },
  {
    key: 'build',
    title: 'Build from my profile',
    detail: 'We write it from the roles, skills and education you’ve added.',
    art: <ProfileExperienceIllustration className="h-auto w-11" />,
  },
  {
    key: 'upload',
    title: 'Upload existing',
    detail: 'PDF or DOCX. We keep its own sections and order.',
    art: <JdArtUploadFileIllustration className="h-auto w-9" />,
  },
  {
    key: 'scratch',
    title: 'Start from scratch',
    detail: 'A blank resume with your name and contact details filled in.',
    art: <NavDocumentsIllustration className="h-auto w-11" />,
  },
];

const COPY: Record<Step, { title: string; lede: string }> = {
  choose: {
    title: 'Create a new resume',
    lede: 'Pick how to start. Nothing is created until you choose.',
  },
  build: {
    title: 'Build from my profile',
    lede: 'We write it from what’s in your profile — nothing is made up.',
  },
  upload: {
    title: 'Upload existing',
    lede: 'PDF or DOCX with selectable text. We keep its own sections and order.',
  },
};

function Footer({ note, children }: { note?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-default px-7 py-4">
      {note && <p className="mr-auto text-body-m text-text-tertiary">{note}</p>}
      {children}
    </div>
  );
}

/**
 * RES 01 (864:2): "Create a new resume" — four ways to start as cards with a radio, then Continue;
 * nothing is created until one is chosen. Tailoring opens the job-first flow, building is RES 02,
 * uploading reads the file and opens it, starting from scratch opens a blank page in the editor.
 */
export function CreateResumeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useGuardedRouter();
  const create = useCreateResume();
  const profile = useProfile();
  const user = useCurrentUser();
  const [step, setStep] = useState<Step>('choose');
  const [way, setWay] = useState<Way>('build');

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setStep('choose');
  };
  const openEditor = (id: string) => {
    close(false);
    router.push(resumeEditorHref(id));
  };
  const next = () => {
    if (way === 'tailor') {
      close(false);
      // The one flow for a job (toreview §155); its step 2 starts on tailoring a resume you have.
      router.push('/create/build' as Route);
    } else if (way === 'scratch') {
      if (create.isPending) return;
      create.mutate(
        { title: 'Untitled resume', docType: 'resume' },
        {
          onSuccess: (r) => openEditor(r.id),
          onError: () => showToast('We couldn’t start a new resume. Try again.', { tone: 'error' }),
        },
      );
    } else setStep(way);
  };
  const hasRoles = (profile.data?.experiences.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={close} size="xl">
      <div className="flex items-start gap-3 px-7 pb-2 pt-6">
        <div className="min-w-0 flex-1">
          {step !== 'choose' && (
            <button
              type="button"
              onClick={() => setStep('choose')}
              className="mb-1.5 flex items-center gap-1 rounded-sm text-body-m font-medium text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              <ChevronRight aria-hidden className="size-4 rotate-180" />
              All ways to start
            </button>
          )}
          <DialogTitle className="text-h2 font-bold text-text-primary">
            {COPY[step].title}
          </DialogTitle>
          <DialogDescription className="mt-1 text-body-l text-text-secondary">
            {COPY[step].lede}
          </DialogDescription>
        </div>
        <DialogClose
          aria-label="Close"
          className={cn(
            iconButton,
            'size-9 rounded-full border border-border-default text-text-primary',
          )}
        >
          <XClose aria-hidden className="size-4" />
        </DialogClose>
      </div>

      {step === 'choose' && (
        <>
          <div
            role="radiogroup"
            aria-label="How to start"
            className="grid min-h-0 gap-3.5 overflow-y-auto px-6 py-4 sm:grid-cols-2"
          >
            {WAYS.map((w) => {
              const on = w.key === way;
              return (
                <button
                  key={w.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setWay(w.key)}
                  onDoubleClick={next}
                  className={cn(
                    rowSurface(on),
                    'relative flex flex-col items-start gap-3 rounded-xl p-4.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                  )}
                >
                  <span className="absolute right-4 top-4">
                    <Radio on={on} />
                  </span>
                  <span aria-hidden>{w.art}</span>
                  <span className="text-title-l font-bold text-text-primary">{w.title}</span>
                  <span className="text-body-l text-text-secondary">
                    {w.key === 'build' && profile.data && !hasRoles
                      ? 'Your profile has no roles yet — add them first, or start from scratch.'
                      : w.detail}
                  </span>
                </button>
              );
            })}
          </div>
          <Footer>
            <DialogClose className={backButton}>Cancel</DialogClose>
            <button
              type="button"
              onClick={next}
              disabled={create.isPending || (way === 'build' && profile.data != null && !hasRoles)}
              className={primaryButton}
            >
              <StableLabel
                label="Continue"
                busyLabel="Opening the editor…"
                busy={create.isPending}
              />
              <ArrowRight aria-hidden className="size-4.5" />
            </button>
          </Footer>
        </>
      )}

      {step === 'upload' && (
        <>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-7 py-5">
            <DropZone onRead={openEditor} />
          </div>
          <Footer note="When it’s read, the editor opens on it so you can check it.">
            <DialogClose className={backButton}>Cancel</DialogClose>
          </Footer>
        </>
      )}

      {step === 'build' &&
        (profile.data && hasRoles ? (
          <BuildFromProfile
            profile={profile.data}
            user={user.data}
            onReady={openEditor}
            footer={({ note, label, busyLabel, busy, onAction }) => (
              <Footer note={note}>
                <DialogClose className={backButton}>Cancel</DialogClose>
                <button type="button" onClick={onAction} disabled={busy} className={primaryButton}>
                  <SparkleIllustration aria-hidden className="h-auto w-4" />
                  <StableLabel label={label} busyLabel={busyLabel} busy={busy} />
                </button>
              </Footer>
            )}
          />
        ) : (
          <div className="px-7 py-5">
            <p className="rounded-lg bg-surface-muted p-4 text-body-l text-text-primary">
              Your profile has no roles yet, so there is nothing true to build from.{' '}
              <Link
                href={'/profile' as Route}
                onClick={() => close(false)}
                className="font-semibold text-text-brand hover:underline"
              >
                Fill in my profile
              </Link>
            </p>
          </div>
        ))}
    </Dialog>
  );
}
