'use client';

import type { Generation, Job, Resume } from '@nextkin/shared/models';

import { LeaveButton } from '@/features/create/components/LeaveButton';
import { RunProgress } from '@/features/create/components/RunProgress';
import { AiOrb } from '@/ui/AiOrb';
import type { RunLine } from '@/features/create/runLines';

import { tailoringLines } from '../tailorLibrary';

/**
 * Step 3 while the run works (owner's reference, toreview §231): the orb, the job and the resume
 * it starts from, the bar and the run's own steps (only the work the user asked for) ticking off. Leaving is fine; the run carries on
 * and the reader is told when it is ready.
 */
export function TailoringStep({
  job,
  generation,
  source,
  onLeave,
}: {
  job: Job;
  generation: Generation;
  source: Resume | undefined;
  onLeave: () => void;
}) {
  const build = generation.origin === 'build';
  // A build run has no tailor plan to list: its own steps instead of an empty list.
  const labels = generation.tailor
    ? tailoringLines(job, generation.tailor)
    : build
      ? [
          'Reading the job description',
          'Writing from your profile',
          'Checking every line',
          'Scoring it against the job',
        ]
      : [];
  // Each line finishes in its share of the bar; the one being worked on spins.
  const active = Math.min(labels.length - 1, Math.floor(generation.progress * labels.length));
  const lines: RunLine[] = labels.map((label, index) => ({
    label,
    state: index < active ? 'done' : index === active ? 'current' : 'todo',
  }));

  return (
    <RunProgress
      art={<AiOrb size="xl" state="writing" />}
      runId={generation.id}
      title={
        build
          ? `Building your resume${job.company ? ` for ${job.company}` : ''}`
          : `Tailoring your resume${job.company ? ` for ${job.company}` : ''}`
      }
      subtitle={
        <>
          <span className="block">{job.title}</span>
          {source && <span className="block">from {source.title}</span>}
        </>
      }
      meter="Writing your resume"
      progress={generation.progress}
      lines={lines}
      note="Usually 10–20 seconds. You can leave — we’ll let you know when it’s ready."
      action={<LeaveButton onLeave={onLeave} />}
    />
  );
}
