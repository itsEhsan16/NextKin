import type { Resume } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { ResumeRow } from './ResumeRow';

export type ResumeListProps = {
  resumes: Resume[];
  status: 'pending' | 'error' | 'success';
  /** Whether the library holds anything at all, before the pills, chips and search narrow it. */
  hasAny: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
  onRetry: () => void;
  onReset: () => void;
  /** Opens "Create New Resume": the first-time empty state's way on (toreview §124). */
  onCreate?: () => void;
};

/** The list, 16px between rows; `ResumesScreen` puts it in the page's one scroll container. */
export function ResumeList({
  resumes,
  status,
  hasAny,
  selectedId,
  onSelect,
  onRetry,
  onReset,
  onCreate,
}: ResumeListProps) {
  // Whatever replaces the skeleton fades in; a list already cached on arrival shows at once.
  const reveal = useReveal(status !== 'pending');

  if (status === 'pending') {
    return (
      <ul className="flex flex-col gap-4">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index}>
            <Skeleton className="h-24 rounded-lg" />
          </li>
        ))}
      </ul>
    );
  }

  if (status === 'error') {
    return (
      <StateView
        className={reveal ? 'animate-reveal' : undefined}
        tone="danger"
        title="Couldn't load your resumes"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={onRetry}
      />
    );
  }

  if (!hasAny) {
    return (
      <StateView
        className={reveal ? 'animate-reveal' : undefined}
        title="No resumes yet"
        message="Tailor one to a job, build one from your profile, upload the one you have, or start from a blank page."
        {...(onCreate ? { actionLabel: 'Create your first resume', onAction: onCreate } : {})}
      />
    );
  }

  if (resumes.length === 0) {
    return (
      <StateView
        className={reveal ? 'animate-reveal' : undefined}
        title="No resumes match"
        message="Try another group, or clear the filters and the search."
        actionLabel="Reset filters"
        onAction={onReset}
      />
    );
  }

  return (
    <ul aria-label="Resumes" className={cn('flex flex-col gap-4', reveal && 'animate-reveal')}>
      {resumes.map((resume) => (
        <li key={resume.id}>
          <ResumeRow
            resume={resume}
            selected={resume.id === selectedId}
            onSelect={() => onSelect(resume.id)}
            onDuplicated={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}
