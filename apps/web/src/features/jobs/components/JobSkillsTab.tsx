import type { Job } from '@nextkin/shared/models';

import { JobTagPills } from './JobTagPills';

/** Skills — the job's full `tags` list, uncapped (cards cap at 4 + overflow), at the panel's size. */
export function JobSkillsTab({ job }: { job: Job }) {
  return <JobTagPills tags={job.tags} size="md" />;
}
