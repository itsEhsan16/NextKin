import { cn } from '@/lib/cn';
import { CollapseFade } from '@/ui/CollapseFade';
import { LogoMarkIllustration } from '@/ui/illustrations';

export type SidebarHeaderProps = {
  /** The rail, as React knows it: labels and tab order only. The look is `rail:` CSS. */
  collapsed: boolean;
  onToggle: () => void;
};

/**
 * The logo (which toggles the panel) and the wordmark. The second, inert bell that sat here is
 * gone (redesign R4, audit SH-03): it showed the same unread dot as the top bar's working bell,
 * so one dot meant two things. The top bar's bell is the one way to the notifications.
 */
export function SidebarHeader({ collapsed, onToggle }: SidebarHeaderProps) {
  return (
    <div className="flex w-full items-center gap-2 transition-[gap] duration-base ease-standard rail:gap-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-press ease-standard hover:bg-surface-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
          // The row has no `justify-center` (it needs to stay flush-left once title/bell are
          // expanded and filling it) — with title and bell collapsed to zero width, this button
          // is the row's only content, so it needs its own centring in that state, or it just
          // sits at the row's left edge instead of the rail's centre. `304:600`'s icons all
          // share one hit-target column; this keeps the logo on it.
          'rail:mx-auto',
        )}
      >
        {/* The board sets this in a white disc, which only separates it from the lavender glass
            panel; on Home's white card the disc is invisible, so the mark stands alone. */}
        <LogoMarkIllustration className="h-[25px] w-6" />
      </button>

      <CollapseFade open="panel" className="min-w-0">
        {/* Heading/H2 (18 at the compact ramp, weight 700 from the role itself) — the smallest
            step that reads as a wordmark rather than a label once the tagline beside it went.
            Clipped, not truncated, so no ellipsis flashes as it collapses. */}
        <span className="block whitespace-nowrap text-h2 text-text-primary">NextKin</span>
      </CollapseFade>
    </div>
  );
}
