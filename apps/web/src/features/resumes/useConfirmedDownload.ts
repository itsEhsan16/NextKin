'use client';

import {
  EXPORT_BLOCK_MESSAGE,
  ExportBlockedError,
  useConfirmAccuracy,
  useExportResume,
} from '@nextkin/shared/queries';
import { useCallback, useEffect, useRef, useState } from 'react';

import { deliverExport } from '@/lib/deliverExport';
import { showToast } from '@/lib/toast';

/**
 * The web's PDF download, with V2 §15 risk 2's accuracy confirmation: before a version's first
 * export the repo refuses (`ExportBlockedError`, reason `accuracy`), the screen shows
 * `AccuracyPrompt` (a dialog over the page), and a "yes" records the confirmation and downloads.
 * An unverified email opens `VerifyEmailDialog` (SYS 03); the other refusals come back as a
 * sentence to show. A download that fails for any other reason says so the same way everywhere:
 * an error toast with Try again (toreview §131).
 */
export function useConfirmedDownload(id: string) {
  const exportResume = useExportResume(id);
  const confirm = useConfirmAccuracy(id);
  const [asking, setAsking] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const fileName = useRef<string | undefined>(undefined);
  // The failure toast's Try again: the latest `start`, kept here since `start` makes the toast.
  const retry = useRef<() => void>(() => undefined);

  const start = useCallback(
    (name?: string) => {
      fileName.current = name;
      setBlocked(null);
      exportResume.mutate('pdf', {
        onSuccess: (result) => deliverExport(result, fileName.current || result.fileName),
        onError: (error) => {
          if (!(error instanceof ExportBlockedError)) {
            showToast('Couldn’t prepare the download.', {
              tone: 'error',
              action: { label: 'Try again', onClick: () => retry.current() },
            });
            return;
          }
          if (error.reason === 'accuracy') setAsking(true);
          else if (error.reason === 'email') setVerifying(true);
          else
            setBlocked(
              error.reason === 'incomplete' ? error.message : EXPORT_BLOCK_MESSAGE[error.reason],
            );
        },
      });
    },
    [exportResume],
  );
  useEffect(() => {
    retry.current = () => start(fileName.current);
  }, [start]);

  const answer = useCallback(
    (confirmed: boolean) => {
      setAsking(false);
      if (confirmed) confirm.mutate(undefined, { onSuccess: () => start(fileName.current) });
    },
    [confirm, start],
  );

  const closeVerify = useCallback(() => setVerifying(false), []);

  const failed =
    (exportResume.isError && !(exportResume.error instanceof ExportBlockedError)) ||
    confirm.isError;
  return {
    start,
    asking,
    answer,
    blocked,
    verifying,
    closeVerify,
    failed,
    busy: exportResume.isPending || confirm.isPending,
  };
}
