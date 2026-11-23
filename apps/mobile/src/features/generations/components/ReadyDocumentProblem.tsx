import { queryPhase } from '@/data/queries';
import { StateView } from '@/ui/StateView';

import { useGenerationsActions } from '../hooks/useGenerationsActions';

/** What can keep a finished run's document from showing (toreview §262). */
export type ReadyDocumentIssue = 'missing' | 'error' | null;

/**
 * Why a ready run's document can't be shown, or null. A run that names no document, one whose
 * document is of the wrong kind, or one that fails to load with nothing cached used to leave a
 * skeleton for ever.
 */
export function readyDocumentIssue(
  resumeId: string,
  content: { data: unknown; isError: boolean; isPending: boolean },
  hasBody: boolean,
): ReadyDocumentIssue {
  if (!resumeId) return 'missing';
  if (queryPhase(content) === 'error') return 'error';
  if (content.data !== undefined && !hasBody) return 'missing';
  return null;
}

/** The finished document, said instead of drawn: where to find it, or a retry. */
export function ReadyDocumentProblem({
  issue,
  what = 'resume',
  onRetry,
}: {
  issue: Exclude<ReadyDocumentIssue, null>;
  what?: 'resume' | 'letter' | 'draft';
  onRetry: () => void;
}) {
  const actions = useGenerationsActions();
  return issue === 'error' ? (
    <StateView
      tone="danger"
      icon="AlertTriangle"
      title={`We couldn’t load your ${what}`}
      message="It’s saved in Resumes. Check your connection and try again."
      actionLabel="Try again"
      onAction={onRetry}
      secondaryLabel="Go to Resumes"
      onSecondary={actions.openResumes}
    />
  ) : (
    <StateView
      tone="danger"
      icon="AlertTriangle"
      title={`Your ${what} was made, but we couldn’t open it`}
      message="Look for it in Resumes. If it isn’t there, try again."
      actionLabel="Go to Resumes"
      onAction={actions.openResumes}
    />
  );
}
