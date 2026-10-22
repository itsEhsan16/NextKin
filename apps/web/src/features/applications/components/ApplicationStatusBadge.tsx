import { Tag } from '@/ui/Tag';

import { STAGE_LABEL, STAGE_TONE, type ApplicationStage } from '../applicationStage';

/**
 * "In Review", "Interview", "Screening"… (286:1337 and on). The board draws every one at the same
 * width, so a column of them lines up down the list; this keeps that with a minimum width.
 */
export function ApplicationStatusBadge({ stage }: { stage: ApplicationStage }) {
  return (
    <Tag tone={STAGE_TONE[stage]} className="min-w-[76px] justify-center px-2.5 py-1">
      {STAGE_LABEL[stage]}
    </Tag>
  );
}
