'use client';

import type { Resume } from '@nextkin/shared/models';
import { useDeleteResume, useDuplicateResume, useRenameResume } from '@nextkin/shared/queries';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { fieldBox } from '@/ui/fieldBox';
import { iconButton } from '@/ui/iconButton';
import { CopyIcon, RenameIcon, TrashIcon } from '@/ui/icons';
import { DotsVertical, Download01, Edit03 } from '@/ui/lineIcons';
import { menuSurfaceMotion } from '@/ui/menuMotion';

import { resumeEditorHref } from '../resumeHref';
import { useConfirmedDownload } from '../useConfirmedDownload';
import { DownloadPrompts } from './DownloadPrompts';

/**
 * A row's kebab (304:3141), which the board draws without a menu (toreview §124): Edit,
 * Duplicate, Download PDF, and Delete behind a confirmation. Download's refusals (a draft, an
 * unconfirmed version) come back as a toast, since the row has no room to say them.
 */

const item =
  'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-body-l font-medium text-text-primary outline-none data-[highlighted]:bg-surface-muted';
const glyph = 'size-4 shrink-0 text-text-secondary';

export function ResumeRowMenu({
  resume,
  onDuplicated,
}: {
  resume: Resume;
  onDuplicated?: (id: string) => void;
}) {
  const router = useRouter();
  const duplicate = useDuplicateResume();
  const remove = useDeleteResume();
  const download = useConfirmedDownload(resume.id);
  const [confirming, setConfirming] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const rename = useRenameResume();
  const renameId = useId();
  const letter = resume.docType === 'cover_letter';

  useEffect(() => {
    if (download.blocked) showToast(download.blocked, { tone: 'info' });
  }, [download.blocked]);

  return (
    <>
      <Dropdown.Root>
        <Dropdown.Trigger asChild>
          <button
            type="button"
            aria-label={`More options for ${resume.title}`}
            className={cn(
              iconButton,
              'pointer-events-auto -my-1.5 -mr-2 text-text-tertiary hover:text-text-primary',
            )}
          >
            <DotsVertical className="size-4" />
          </button>
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content
            align="end"
            sideOffset={6}
            className={cn(
              'z-50 min-w-56 rounded-lg border border-border-default bg-surface-card p-1.5 shadow-popover',
              menuSurfaceMotion,
            )}
          >
            <Dropdown.Item
              className={item}
              onSelect={() => router.push(resumeEditorHref(resume.id))}
            >
              <Edit03 aria-hidden className={glyph} />
              {letter ? 'Edit letter' : 'Edit'}
            </Dropdown.Item>
            <Dropdown.Item className={item} onSelect={() => setRenaming(resume.title)}>
              <RenameIcon aria-hidden className={glyph} />
              Rename
            </Dropdown.Item>
            <Dropdown.Item
              className={item}
              disabled={duplicate.isPending}
              onSelect={() =>
                duplicate.mutate(resume.id, {
                  onSuccess: (copy) => {
                    showToast(`Copied “${resume.title}”.`, { tone: 'success' });
                    onDuplicated?.(copy.id);
                  },
                  onError: () =>
                    showToast('We couldn’t make a copy. Try again.', { tone: 'error' }),
                })
              }
            >
              <CopyIcon aria-hidden className={glyph} />
              Duplicate
            </Dropdown.Item>
            <Dropdown.Item
              className={item}
              disabled={download.busy}
              onSelect={() => download.start()}
            >
              <Download01 aria-hidden className={glyph} />
              Download PDF
            </Dropdown.Item>
            <Dropdown.Separator className="my-1 h-px bg-border-faint" />
            <Dropdown.Item
              className={cn(item, 'text-danger-600')}
              onSelect={() => setConfirming(true)}
            >
              <TrashIcon aria-hidden className="size-4 shrink-0" />
              Delete
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
      <DownloadPrompts download={download} />
      <ConfirmDialog
        open={renaming !== null}
        tone="brand"
        title={letter ? 'Rename this letter' : 'Rename this resume'}
        message="Only the name changes. Nothing on the page does."
        confirmLabel="Save name"
        busyLabel="Saving…"
        busy={rename.isPending}
        onCancel={() => setRenaming(null)}
        onConfirm={() => {
          const title = (renaming ?? '').trim();
          if (!title || title === resume.title) return setRenaming(null);
          rename.mutate(
            { id: resume.id, title: title.slice(0, 200) },
            {
              onSuccess: () => setRenaming(null),
              onError: () => showToast('We couldn’t rename it. Try again.', { tone: 'error' }),
            },
          );
        }}
      >
        <label htmlFor={renameId} className="sr-only">
          Name
        </label>
        <input
          id={renameId}
          value={renaming ?? ''}
          maxLength={200}
          onChange={(e) => setRenaming(e.target.value)}
          className={cn(fieldBox, 'h-control-lg px-3.5 text-body-l')}
        />
      </ConfirmDialog>
      <ConfirmDialog
        open={confirming}
        title={`Delete “${resume.title}”?`}
        message="Its versions go with it. This can’t be undone."
        confirmLabel={letter ? 'Delete letter' : 'Delete resume'}
        busyLabel="Deleting…"
        busy={remove.isPending}
        onCancel={() => setConfirming(false)}
        // The row leaves the list as soon as the delete starts, taking this menu with it, so the
        // outcome is read from the promise rather than from callbacks tied to the row.
        onConfirm={() => {
          const title = resume.title;
          remove.mutateAsync(resume.id).then(
            () => showToast(`Deleted “${title}”.`, { tone: 'success' }),
            () => showToast(`We couldn’t delete “${title}”. Try again.`, { tone: 'error' }),
          );
        }}
      />
    </>
  );
}
