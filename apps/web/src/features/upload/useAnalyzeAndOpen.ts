import type { JdInput } from '@nextkin/shared/models';
import { useExtractJd } from '@nextkin/shared/queries';
import { useRouter } from 'next/navigation';

import { jdHref, jdTailorHref } from '../jd/jdHref';

/**
 * Analyze, then the job (toreview §129, owner 2026-10-21, reversing §114): the JD is read and the
 * user lands on its own page, shown as a proper job description with every section, and tailors
 * from there. The button keeps saying "Analyzing…" until the page arrives, so there is no flash of
 * an idle form. Home's Build Resume still opens the build screen straight away (toreview §125).
 */
export type AnalyzeIntent = 'tailor' | 'build';

export function useAnalyzeAndOpen(intent: AnalyzeIntent = 'tailor') {
  const extract = useExtractJd();
  const router = useRouter();
  const analyze = (input: JdInput) =>
    extract.mutate(input, {
      onSuccess: (draft) =>
        router.push(
          intent === 'build' ? jdTailorHref(draft.id, { mode: 'build' }) : jdHref(draft.id),
        ),
    });
  const busy = extract.isPending || extract.isSuccess;
  return { extract, analyze, busy };
}
