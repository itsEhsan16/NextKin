import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { LegalDocKey, SupportTopic } from '@/data/models';

/** Every navigation the Help, Contact and Legal screens make (V2 §7.14, §8.5). */
export function useSupportActions() {
  const router = useRouter();

  return useMemo(
    () => ({
      goBack: () => router.back(),
      /**
       * The FAQ's "Still stuck?" footer carries the topic through, so the message form opens on
       * the subject the reader was already reading about rather than back at "A question".
       */
      openContact: (topic?: SupportTopic) =>
        router.push(
          topic ? { pathname: '/support/contact', params: { topic } } : '/support/contact',
        ),
      openHelp: () => router.push('/support/help'),
      openLegal: (doc: LegalDocKey) =>
        router.push({ pathname: '/legal/[doc]', params: { doc } }),
    }),
    [router],
  );
}
