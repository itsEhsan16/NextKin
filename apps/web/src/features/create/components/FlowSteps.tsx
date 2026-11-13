import type { Route } from 'next';

import { Stepper } from '@/ui/Stepper';

/**
 * A flow's three steps (738:30). Tailoring's header and the Quick Start flows share it (toreview
 * §125). Now `ui/Stepper` (redesign R3d); this name stays for its callers.
 */
export function FlowSteps({
  steps,
  step,
  hrefs,
}: {
  steps: readonly string[];
  step: number;
  hrefs?: readonly (Route | undefined)[];
}) {
  return <Stepper steps={steps} step={step} {...(hrefs ? { hrefs } : {})} />;
}
