import { cn } from '@/lib/cn';

/**
 * The "Basis" annotation tag (Figma 524:406): a pin, a leader line and a pill naming where a
 * number comes from. The page's signature: every number shows its basis.
 *
 * Animations target `.lp-tag-pin`, `.lp-tag-leader` (scaleX from the left) and `.lp-tag-label`.
 */
export function AnnotationTag({
  kind = 'Basis',
  note,
  className,
}: {
  kind?: string;
  note: string;
  className?: string;
}) {
  return (
    <div className={cn('lp-tag flex items-center', className)} data-lp-tag>
      <img
        src="/landing/pin.svg"
        alt=""
        width={10}
        height={10}
        className="lp-tag-pin size-[10px] shrink-0"
      />
      <span className="lp-tag-leader h-px w-[56px] shrink-0 origin-left bg-lp-violet/60" />
      <span className="lp-tag-label flex shrink-0 items-center gap-2 rounded-full border border-lp-violet-line bg-lp-white px-3 py-[7px] whitespace-nowrap shadow-lp-tag">
        <span className="text-[11px] font-semibold tracking-[0.66px] text-lp-violet uppercase">
          {kind}
        </span>
        <span className="text-[13px] font-medium text-lp-ink-2">{note}</span>
      </span>
    </div>
  );
}
