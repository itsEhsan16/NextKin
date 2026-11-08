'use client';

import type { Profile } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';
import { useRef, useState, type DragEvent } from 'react';

import { useGuardedRouter } from '@/navigation/guardedRouter';
import { useResumeUpload } from '@/features/create/jobFlow/useResumeUpload';
import { RESUME_INPUT_ACCEPT } from '@/features/onboarding/resumeUpload';
import { cn } from '@/lib/cn';
import { textLink } from '@/ui/textLink';
import {
  Clipboard,
  Edit03,
  File06,
  LinkExternal01,
  Target04,
  UploadCloud02,
  User01,
  Zap,
} from '@/ui/lineIcons';

import { DialogFact, MethodDialog } from './MethodDialog';
import { METHOD_ART, METHOD_TITLE, type Method } from './methods';

const linkAction = cn(textLink, 'flex items-center gap-1 text-body-m font-semibold');

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
        points={[
          'Keep your existing experience, education, and sections',
          'Add the job’s skills and keywords you choose',
          'Get suggestions to make your lines stronger, like adding real results',
        ]}
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
        points={[
          'Use your existing profile information',
          'Keep your details consistent across future resumes',
          'You can update your profile anytime',
        ]}
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
        points={[
          'Quick and guided — just three answers',
          'An AI-written first draft aimed at the role',
          'You’re in full control — we mark every guess for you to check',
        ]}
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

/** The upload popup: drop or browse, then "Upload" reads it, and the read resume is the choice. */
function UploadDialog({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: (upload: { resumeId: string; name: string }) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const upload = useResumeUpload((resumeId) =>
    onUploaded({ resumeId, name: file?.name ?? 'your resume' }),
  );
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };
  return (
    <MethodDialog
      open
      onClose={onClose}
      art={METHOD_ART.upload}
      title={METHOD_TITLE.upload}
      line="Upload an existing resume (PDF or DOCX), and we’ll read it and tailor it to this job."
      confirmLabel="Upload"
      busyLabel="Reading your resume…"
      busy={upload.reading}
      disabled={!file}
      onConfirm={() => file && upload.pick(file)}
    >
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={cn(
          'flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-5 py-6 text-center transition-colors duration-press ease-standard',
          dragging ? 'border-brand-600 bg-brand-50' : 'border-border-brand-strong bg-surface-brand',
        )}
      >
        <UploadCloud02 aria-hidden className="size-7 text-text-brand" />
        <p className="text-body-l font-medium text-text-primary">
          {file ? (
            <span title={file.name} className="block max-w-full truncate font-semibold">
              {file.name}
            </span>
          ) : (
            'Drop your resume here, or '
          )}
          <button
            type="button"
            onClick={() => input.current?.click()}
            className={cn(textLink, 'font-semibold underline')}
          >
            {file ? 'Choose another file' : 'browse files'}
          </button>
        </p>
        <p className="text-body-s font-medium text-text-tertiary">PDF or DOCX</p>
      </div>
      {upload.error && (
        <p role="alert" className="text-body-m text-danger-600">
          {upload.error}
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Zap, text: 'Extract your information automatically' },
          { icon: Target04, text: 'Tailor it to the job description' },
          { icon: Edit03, text: 'You can review and edit everything' },
        ].map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2.5 text-body-s text-text-secondary">
            <Icon aria-hidden className="size-5 shrink-0 text-text-brand" />
            {text}
          </li>
        ))}
      </ul>
      <input
        ref={input}
        type="file"
        accept={RESUME_INPUT_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Resume file"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          if (picked) setFile(picked);
          event.target.value = '';
        }}
      />
    </MethodDialog>
  );
}
