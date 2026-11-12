import { cn } from '@/lib/cn';
import { InfoCircle } from '@/ui/lineIcons';

/**
 * How long a run usually takes, as an honest range (redesign R3c; Jobright §2.3 step 2b,
 * adopted): "Usually takes 10–20 seconds". Never a made-up percentage. The range should come from
 * measured run times; a run that outlives it hands over to the stall copy (`useStall`).
 */
export function TimeEstimateNote({
  children,
  className,
}: {
  /** "Usually takes 10–20 seconds". */
  children: string;
  className?: string;
}) {
  return (
    <p className={cn('flex items-center gap-1.5 text-body-s text-text-tertiary', className)}>
      <InfoCircle aria-hidden className="size-4 shrink-0" />
      {children}
    </p>
  );
}
