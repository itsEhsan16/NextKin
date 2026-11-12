'use client';

import * as Dropdown from '@radix-ui/react-dropdown-menu';
import type { AssistantAttachment } from '@nextkin/shared/models';
import {
  queryPhase,
  useDocuments,
  useJobCatalogue,
  useResumes,
  useSavedJobs,
} from '@nextkin/shared/queries';
import type { ComponentType, ReactNode, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import {
  AttachIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  DocumentIcon,
  LockIcon,
  UploadIcon,
} from '@/ui/icons';
import {
  AssistantBookmarkIllustration,
  AssistantTermsIllustration,
  JdArtUploadFileIllustration,
  NavDocumentsIllustration,
} from '@/ui/illustrations';
import { menuSurfaceMotion } from '@/ui/menuMotion';

import {
  documentAttachment,
  jobAttachment,
  resumeAttachment,
  resumeLine,
} from '../assistantLibrary';
import { iconButton } from '@/ui/iconButton';

type Art = ComponentType<SVGProps<SVGSVGElement>>;

const SURFACE = cn(
  'z-dropdown flex flex-col gap-0.5 rounded-xl border border-border-default bg-surface-card px-2 pb-2 pt-2.5 shadow-popover outline-none',
  menuSurfaceMotion,
);

const ROW =
  'flex cursor-pointer items-center gap-3 rounded-lg py-2 pl-2.5 pr-3 outline-none transition-colors duration-press ease-standard data-[highlighted]:bg-brand-50/60 data-[state=open]:bg-brand-50/60 data-[disabled]:cursor-default data-[disabled]:opacity-60';

function Head({ children }: { children: ReactNode }) {
  return (
    <Dropdown.Label className="pb-1.5 pl-2.5 text-body-s font-semibold text-text-tertiary">
      {children}
    </Dropdown.Label>
  );
}

/** One way in (772:332): the board's art on a lavender tile, what it is, and where it leads. */
function OptionBody({ Art, title, detail }: { Art: Art; title: string; detail: string }) {
  return (
    <>
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-brand-strong"
      >
        <Art className="h-auto max-h-7 w-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-l font-semibold text-text-primary">{title}</span>
        <span className="block truncate text-body-s font-medium text-text-tertiary">{detail}</span>
      </span>
    </>
  );
}

type Pick = { key: string; title: string; line: string; attachment: AssistantAttachment };

/** An option that opens a list of the user's own things (772:418, "Your resumes"). */
function PickerOption({
  Art,
  title,
  detail,
  heading,
  picks,
  empty,
  status,
  isAttached,
  onPick,
}: {
  Art: Art;
  title: string;
  detail: string;
  heading: string;
  picks: Pick[];
  empty: string;
  /** Until the list has loaded, or if it failed, the flyout says so rather than "none". */
  status: 'pending' | 'error' | 'success';
  isAttached: (attachment: AssistantAttachment) => boolean;
  onPick: (attachment: AssistantAttachment) => void;
}) {
  return (
    <Dropdown.Sub>
      <Dropdown.SubTrigger className={ROW}>
        <OptionBody Art={Art} title={title} detail={detail} />
        <ChevronRightIcon aria-hidden className="size-3.5 shrink-0 text-neutral-400" />
      </Dropdown.SubTrigger>
      <Dropdown.Portal>
        <Dropdown.SubContent
          sideOffset={10}
          alignOffset={-8}
          className={cn(
            SURFACE,
            'max-h-[min(360px,var(--radix-dropdown-menu-content-available-height))] w-[300px] overflow-y-auto rounded-xl',
          )}
        >
          <Head>{heading}</Head>
          {picks.length === 0 && (
            <p className="px-2.5 py-2 text-body-s text-text-tertiary">
              {status === 'pending'
                ? 'Loading…'
                : status === 'error'
                  ? "Couldn't load these. Close the menu and try again."
                  : empty}
            </p>
          )}
          {picks.map((pick) => {
            const attached = isAttached(pick.attachment);
            return (
              <Dropdown.Item
                key={pick.key}
                className={cn(ROW, attached && 'bg-brand-50/60')}
                onSelect={() => onPick(pick.attachment)}
              >
                <span
                  aria-hidden
                  className="flex h-[38px] w-[30px] shrink-0 items-center justify-center rounded-sm border border-border-default bg-surface-card text-neutral-400"
                >
                  <DocumentIcon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-m font-semibold text-text-primary">
                    {pick.title}
                  </span>
                  <span className="block truncate text-micro font-medium text-text-tertiary">
                    {pick.line}
                  </span>
                </span>
                {attached && (
                  <CheckCircleIcon
                    role="img"
                    aria-label="Attached"
                    className="size-4 shrink-0 animate-pop-in text-text-brand"
                  />
                )}
              </Dropdown.Item>
            );
          })}
        </Dropdown.SubContent>
      </Dropdown.Portal>
    </Dropdown.Sub>
  );
}

const andMore = (first: string | undefined, count: number, none: string) =>
  !first ? none : count > 1 ? `${first} and ${count - 1} more` : first;

/**
 * The composer's paperclip and what it opens (772:329): a file from the computer, one of the
 * user's resumes, a cover letter from Documents, or a saved job, each opening its own list
 * (772:418). Picking something attaches it; picking it again takes it off. Everything here is
 * read, never changed, as the menu's foot says.
 */
export function AttachMenu({
  open,
  onOpenChange,
  isAttached,
  onToggle,
  onUploadFile,
  disabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAttached: (attachment: AssistantAttachment) => boolean;
  onToggle: (attachment: AssistantAttachment) => void;
  onUploadFile: () => void;
  disabled: boolean;
}) {
  const resumes = useResumes();
  const documents = useDocuments();
  const saved = useSavedJobs();
  const catalogue = useJobCatalogue();

  const companyOf = (jobId: string | undefined) =>
    jobId ? catalogue.data?.find((job) => job.id === jobId)?.company : undefined;

  const resumePicks: Pick[] = (resumes.data ?? [])
    .filter((resume) => !resume.archived && resume.docType === 'resume')
    .map((resume) => ({
      key: resume.id,
      title: resume.title,
      line: resumeLine(resume, resume.targetCompany ?? companyOf(resume.linkedJobId)),
      attachment: resumeAttachment(resume),
    }));
  const letterPicks: Pick[] = (documents.data ?? [])
    .filter((document) => document.kind === 'cover_letter')
    .map((document) => ({
      key: document.id,
      title: document.title,
      line: 'From your Documents',
      attachment: documentAttachment(document),
    }));
  const jobPicks: Pick[] = (saved.data ?? []).map((job) => ({
    key: job.id,
    title: `${job.company} — ${job.title}`,
    line: job.location,
    attachment: jobAttachment(job),
  }));

  return (
    <Dropdown.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dropdown.Trigger
        disabled={disabled}
        aria-label="Add to your message"
        className={cn(
          iconButton,
          'size-control-md shrink-0 rounded-full text-text-tertiary outline-none',
          'hover:text-text-brand data-[state=open]:bg-brand-50 data-[state=open]:text-text-brand disabled:opacity-60',
        )}
      >
        <AttachIcon aria-hidden className="size-5" />
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          side="top"
          align="start"
          sideOffset={14}
          alignOffset={-10}
          className={cn(SURFACE, 'w-[340px]')}
        >
          <Head>Add to your message</Head>
          <Dropdown.Item className={ROW} onSelect={onUploadFile}>
            <OptionBody
              Art={JdArtUploadFileIllustration}
              title="Upload a file"
              detail="PDF or DOCX from your computer"
            />
            <UploadIcon aria-hidden className="size-3.5 shrink-0 text-neutral-400" />
          </Dropdown.Item>
          <PickerOption
            Art={AssistantTermsIllustration}
            title="A resume on NextKin"
            detail={
              resumes.isPending
                ? 'Loading…'
                : andMore(resumePicks[0]?.title, resumePicks.length, 'None yet')
            }
            heading="Your resumes"
            picks={resumePicks}
            empty="You have no resumes yet."
            status={queryPhase(resumes)}
            isAttached={isAttached}
            onPick={onToggle}
          />
          <PickerOption
            Art={NavDocumentsIllustration}
            title="A cover letter"
            detail="From your Documents"
            heading="Your cover letters"
            picks={letterPicks}
            empty="No cover letters in your Documents."
            status={queryPhase(documents)}
            isAttached={isAttached}
            onPick={onToggle}
          />
          <PickerOption
            Art={AssistantBookmarkIllustration}
            title="A saved job"
            detail="Ask about a specific listing"
            heading="Your saved jobs"
            picks={jobPicks}
            empty="Save a job on the Jobs page to ask about it here."
            status={queryPhase(saved)}
            isAttached={isAttached}
            onPick={onToggle}
          />
          <p className="flex items-center gap-1.5 pb-0.5 pl-2.5 pt-2 text-micro font-medium text-neutral-400">
            <LockIcon aria-hidden className="size-2.5" />
            Read only — the assistant never edits your files.
          </p>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
