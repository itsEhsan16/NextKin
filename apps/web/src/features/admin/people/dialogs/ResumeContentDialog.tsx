'use client';

import { useEffect, useId, useState } from 'react';

import type { AdminResumeContent, AdminUserResume } from '@nextkin/shared/models';
import { useReadResume } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminDialog } from '../../ui/AdminDialog';
import { AdminDrawer, PanelHeading } from '../../ui/AdminDrawer';
import { FieldLabel, TextArea } from '../../ui/AdminForm';
import { FeaturedIcon } from '../../ui/FeaturedIcon';
import { Notice } from '../components/Notice';
import { formatShortDate } from '../peopleFormat';
import { errorText, MAX_NOTE } from './SuspendDialogs';

/** The server refuses a shorter reason (`readUserResume`); the field says so before it's sent. */
const MIN_REASON = 10;

export const resumeTitle = (resume: AdminUserResume) =>
  `Resume · updated ${formatShortDate(resume.updatedAt)}`;

/** "2 pages · template Modern"; a resume never rendered or without a template leaves that part out. */
export const resumeFacts = (resume: AdminUserResume) =>
  [
    resume.pages === null
      ? 'Not rendered yet'
      : `${resume.pages} page${resume.pages === 1 ? '' : 's'}`,
    resume.template === null ? null : `template ${resume.template}`,
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * "Open resume content?" (Figma 407:3095). Reading a user's resume is exceptional: a reason of
 * ten characters or more is required, a case reference is optional, and the read is written to
 * the audit log with the staff member's name. The content then shows read-only in a side panel
 * and isn't kept anywhere once the panel closes.
 */
export function ResumeContentDialog({
  user,
  resume,
  onClose,
}: {
  user: { id: string; name: string };
  /** The resume to open; `null` when the dialog is closed. */
  resume: AdminUserResume | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [caseRef, setCaseRef] = useState('');
  const [content, setContent] = useState<AdminResumeContent | null>(null);
  const read = useReadResume();
  const caseId = useId();
  const short = reason.trim().length < MIN_REASON;
  const { reset } = read;
  // The content lives only while the panel is open: leaving the page drops the mutation's copy.
  useEffect(() => reset, [reset]);

  const close = () => {
    setReason('');
    setCaseRef('');
    onClose();
  };

  return (
    <>
      <AdminDialog
        open={resume !== null && content === null}
        onOpenChange={(open) => !open && close()}
        icon="Lock01"
        tone="warning"
        title="Open resume content?"
        description="Reading a user's resume is exceptional. Your reason is recorded in the audit log with your name."
        confirm={{
          label: 'Open read-only',
          icon: 'Eye',
          disabled: short,
          busy: read.isPending,
          onConfirm: () =>
            resume &&
            read.mutate(
              { id: user.id, resumeId: resume.id, reason, caseRef },
              {
                onSuccess: setContent,
                onError: (error) => showToast(errorText(error), { tone: 'error' }),
              },
            ),
        }}
      >
        {resume && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-3.5 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-neutral-200 bg-surface-card text-neutral-600 shadow-xs">
                <AdminIcon name="File06" size="md" />
              </span>
              <div className="flex min-w-0 flex-col text-body-s">
                <span className="font-semibold text-text-primary">{resumeTitle(resume)}</span>
                <span className="text-text-secondary">
                  {user.name} · {resumeFacts(resume)}
                </span>
              </div>
            </div>
            <TextArea
              label="Reason"
              required
              maxLength={MAX_NOTE}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              hint="At least 10 characters"
            />
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor={caseId}>Case reference</FieldLabel>
              <label className="flex h-11 items-center gap-2 rounded-sm border border-neutral-300 bg-surface-card px-3.5 shadow-xs focus-within:border-border-selected focus-within:ring-4 focus-within:ring-brand-100">
                <AdminIcon name="Link01" className="text-neutral-500" />
                <input
                  id={caseId}
                  value={caseRef}
                  onChange={(event) => setCaseRef(event.target.value)}
                  placeholder="SUP-2231"
                  className="min-w-0 flex-1 bg-transparent text-body-m text-text-primary outline-none placeholder:text-text-tertiary"
                />
              </label>
            </div>
            <Notice tone="info" icon="InfoCircle">
              Access is read-only and ends when you close the resume.
            </Notice>
          </div>
        )}
      </AdminDialog>

      <AdminDrawer
        open={content !== null}
        onOpenChange={(open) => {
          if (!open) {
            setContent(null);
            read.reset();
            close();
          }
        }}
        title={resume ? resumeTitle(resume) : 'Resume'}
        badge={
          <AdminBadge tone="warning" dot>
            Read-only
          </AdminBadge>
        }
        subtitle={`${user.name} · opened with a recorded reason`}
        footerNote="This read is in the audit log with your name"
      >
        <div className="flex items-start gap-3">
          <FeaturedIcon name="Eye" tone="warning" size="sm" />
          <p className="text-body-s text-text-secondary">
            Close this panel when you&apos;re done. Nothing here is saved or downloadable.
          </p>
        </div>
        {content?.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-2">
            <PanelHeading>{section.heading}</PanelHeading>
            {section.lines.map((line) => (
              <p key={line} className="text-body-m text-text-primary">
                {line}
              </p>
            ))}
          </section>
        ))}
      </AdminDrawer>
    </>
  );
}
