import type { Generation } from '@/data/models';

import { GENERATING_RESUME_ID } from './resumes';
import { daysAgo, minutesAgo } from './time';

export const ACTIVE_GENERATION_ID = 'gen_active';

export const generationsFixture: Generation[] = [
  {
    id: ACTIVE_GENERATION_ID,
    resumeId: GENERATING_RESUME_ID,
    jobId: 'job_4',
    status: 'generating',
    progress: 0.45,
    startedAt: minutesAgo(2),
    updatedAt: minutesAgo(1),
  },
  {
    id: 'gen_done_1',
    resumeId: 'res_1',
    jobId: 'job_1',
    status: 'ready',
    progress: 1,
    startedAt: daysAgo(12),
    updatedAt: daysAgo(12),
  },
  {
    id: 'gen_failed_1',
    resumeId: undefined,
    jobId: 'job_7',
    status: 'failed',
    progress: 0.3,
    startedAt: daysAgo(5),
    updatedAt: daysAgo(5),
    error: 'The job description could not be parsed. Try pasting it manually.',
  },
];
