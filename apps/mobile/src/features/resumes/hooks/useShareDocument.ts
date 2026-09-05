import { useCallback } from 'react';

import { useShareLink } from '@/data/queries';
import { copyToClipboard, shareText } from '@/lib';

import { useResumesStore, type ResumeSurface } from '../resumesStore';

/** Said when the OS sheet never appeared and the link went to the clipboard instead. */
export const SHARE_COPIED = 'Link copied';
/** Said when neither the share sheet nor the clipboard was reachable. */
export const SHARE_UNAVAILABLE = "This device can't share right now";
export const SHARE_FAILED = "We couldn't make a link. Try again.";

/**
 * V2 §7.12's view-only link. There is no screen: the repo mints the URL, the OS sheet takes it,
 * and a runtime with no sheet falls back to the clipboard so the tap still produces something the
 * reader can paste. Every outcome is confirmed on the surface that asked, because `Share.share`
 * on Android resolves the same way whether the link reached anywhere or not.
 */
export function useShareDocument(id: string, surface: ResumeSurface = 'tabs') {
  const link = useShareLink(id);
  const showToast = useResumesStore((state) => state.showToast);

  const share = useCallback(() => {
    if (id.length === 0) return;
    link.mutate(undefined, {
      onSuccess: async (url) => {
        const result = await shareText(url, { title: 'Your NextKin document', url });
        if (result !== 'unavailable') return;
        const copied = await copyToClipboard(url);
        showToast(copied === 'done' ? SHARE_COPIED : SHARE_UNAVAILABLE, surface);
      },
      onError: () => showToast(SHARE_FAILED, surface),
    });
  }, [id, link, showToast, surface]);

  return { share, sharing: link.isPending };
}
