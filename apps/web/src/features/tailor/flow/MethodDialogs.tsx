'use client';

import type { Profile } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import { useGuardedRouter } from '@/navigation/guardedRouter';
import { ResumeDropArea } from '@/features/create/components/ResumeDropArea';
import { changeLink } from '@/ui/textLink';
import { Clipboard, File06, LinkExternal01, User01 } from '@/ui/lineIcons';

import { DialogFact, MethodDialog } from './MethodDialog';
import { METHOD_ART, METHOD_TITLE, type Method } from './methods';

const linkAction = changeLink;

/**
 * The four popups behind "How would you like to create your resume?" (owner mockup 2026-11-02,
 * toreview §151). Each says what the way does and only asks what that way needs. Its button
 * chooses that way (owner, toreview §157): the step's Continue then goes on. The upload one reads
 * the file first, so a chosen upload is a resume ready to tailor.
 */
export function MethodDialogs({
  open,
  onClose,
  jobTitle,
  resumeTitle,
  profile,
  onChangeResume,
  onChoose,
}: {
  open: Method | null;
  onClose: () => void;
  jobTitle: string;
  resumeTitle: string | undefined;
  profile: Profile | undefined;
  onChangeResume: () => void;
  /** The way, chosen; an upload brings the resume it read. */
  onChoose: (method: Method, upload?: { resumeId: string; name: string }) => void;
}) {
  const router = useGuardedRouter();
  const roles = profile?.experiences.length ?? 0;
  return (
    <>
      <MethodDialog
        open={open === 'tailor'}
        onClose={onClose}
        art={METHOD_ART.tailor}
        title={METHOD_TITLE.tailor}
        line={`Use your existing resume as a base and tailor it to the ${jobTitle} job with AI.`}
        confirmLabel="Use this resume"
        onConfirm={() => onChoose('tailor')}
      >
        <DialogFact
          icon={<File06 className="size-5" />}
          label="Selected resume"
          value={<span className="font-semibold text-text-primary">{resumeTitle ?? '—'}</span>}
          aside={
            <button type="button" onClick={onChangeResume} className={linkAction}>
              Change
            </button>
          }
        />
      </MethodDialog>

      <MethodDialog
        open={open === 'profile'}
        onClose={onClose}
        art={METHOD_ART.profile}
        title={METHOD_TITLE.profile}
        line="Build a resume using your saved work experience, education, and skills."
        confirmLabel={roles > 0 || !profile ? 'Use my profile' : 'Fill in my profile'}
        disabled={!profile}
        // A profile with no roles has nothing to build from: the button opens the profile instead.
        onConfirm={() => (roles > 0 ? onChoose('profile') : router.push('/profile' as Route))}
      >
        <DialogFact
          icon={<User01 className="size-5" />}
          label={roles > 0 || !profile ? 'Your profile includes' : 'Your profile has no roles yet'}
          value={
            profile
              ? [
                  `Experience (${roles})`,
                  `Education (${profile.education.length})`,
                  `Skills (${profile.skills.length})`,
                ].join(' · ')
              : 'Loading your profile…'
          }
          aside={
            <Link href={'/profile' as Route} target="_blank" className={linkAction}>
              View profile
              <LinkExternal01 aria-hidden className="size-4" />
            </Link>
          }
        />
      </MethodDialog>

      <MethodDialog
        open={open === 'zero'}
        onClose={onClose}
        art={METHOD_ART.zero}
        title={METHOD_TITLE.zero}
        line="Answer three questions, and we’ll write a first draft for you to review and edit."
        confirmLabel="Start with AI"
        onConfirm={() => onChoose('zero')}
      >
        <DialogFact
          icon={<Clipboard className="size-5" />}
          label="You’ll be asked for"
          value="Your name · Years of experience · The role you want"
        />
      </MethodDialog>

      {open === 'upload' && (
        <UploadDialog onClose={onClose} onUploaded={(upload) => onChoose('upload', upload)} />
      )}
    </>
  );
}

/**
 * The upload popup (owner, toreview §221): the art, title and line, then the one drop zone every
 * upload uses (`ResumeDropArea`, §257). The popup holds its × while a file is read.
 */
function UploadDialog({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: (upload: { resumeId: string; name: string }) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <MethodDialog
      open
      onClose={onClose}
      art={METHOD_ART.upload}
      title={METHOD_TITLE.upload}
      line="Upload an existing resume (PDF or DOCX), and we’ll read it and tailor it to this job."
      busy={busy}
    >
      <ResumeDropArea onUploaded={onUploaded} onBusyChange={setBusy} />
    </MethodDialog>
  );
}
