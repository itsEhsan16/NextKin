import { Stepper } from '@/ui/Stepper';

/**
 * A flow's three steps (738:30). Tailoring's header and the Quick Start flows share it (toreview
 * §125). Now `ui/Stepper` (redesign R3d); this name stays for its callers.
 */
export function FlowSteps({ steps, step }: { steps: readonly string[]; step: number }) {
  return <Stepper steps={steps} step={step} />;
}
