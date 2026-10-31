import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { unreadableLinkMessage, useImportJobLink, useJobLinkPreview } from '@/data/queries';
import { Dialog } from '@/ui/Dialog';
import { Toast } from '@/ui/Toast';

import { COPIED_LINK_TITLE, CopiedLinkDialogBody } from './components/CopiedLinkDialogBody';
import { useHomeStore } from './homeStore';

export const ADD_FAILED = "We couldn't add that job. Check your connection and try again.";
export const SAVED_NOTICE = 'Saved to your jobs';

/**
 * TAILOR 00c, hosted over the tab bar beside the menu sheet so its scrim dims the chrome, as the
 * board draws it. The link Home found is read first; the dialog opens only once it names a job,
 * and a link that cannot be read is never asked about (there would be nothing to offer).
 *
 * Both answers add the job to Saved jobs first (owner, 2026-10-04): "Tailor my resume to it" then
 * opens TAILOR 01 — the compare screen with its resume picker up — exactly as for any NextKin job.
 */
export function CopiedLinkHost() {
  const router = useRouter();
  const url = useHomeStore((state) => state.copiedLink);
  const phase = useHomeStore((state) => state.copiedLinkPhase);
  const openDialog = useHomeStore((state) => state.openCopiedLink);
  const close = useHomeStore((state) => state.closeCopiedLink);

  const preview = useJobLinkPreview(url ?? '');
  const add = useImportJobLink();
  const [busy, setBusy] = useState<'tailor' | 'save' | null>(null);
  const [failure, setFailure] = useState<string>();
  const [notice, setNotice] = useState<string | null>(null);

  // A fresh link opens the dialog once it has been read; one that will not read is let go.
  useEffect(() => {
    if (!url || phase !== 'reading') return;
    if (preview.isSuccess) {
      openDialog();
    } else if (preview.isError) {
      close();
    }
  }, [close, openDialog, phase, preview.isError, preview.isSuccess, url]);

  // A failure belongs to the link it happened on: closing clears it before the next one.
  const dismiss = () => {
    setFailure(undefined);
    close();
  };

  const answer = (kind: 'tailor' | 'save') => {
    if (!url || busy) return;
    setBusy(kind);
    setFailure(undefined);
    add.mutate(url, {
      onSuccess: (job) => {
        dismiss();
        if (kind === 'tailor') {
          router.push({ pathname: '/create/tailor', params: { jobId: job.id } });
        } else {
          setNotice(SAVED_NOTICE);
        }
      },
      onError: (error) => setFailure(unreadableLinkMessage(error) ?? ADD_FAILED),
      onSettled: () => setBusy(null),
    });
  };

  return (
    <>
      {preview.data ? (
        <Dialog open={phase === 'open'} onClose={dismiss} accessibilityLabel={COPIED_LINK_TITLE}>
          <CopiedLinkDialogBody
            preview={preview.data}
            busy={busy}
            failure={failure}
            onTailor={() => answer('tailor')}
            onSave={() => answer('save')}
            onDismiss={dismiss}
          />
        </Dialog>
      ) : null}
      <Toast visible={notice != null} message={notice ?? ''} onHide={() => setNotice(null)} />
    </>
  );
}
