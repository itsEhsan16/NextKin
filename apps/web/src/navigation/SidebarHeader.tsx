import { cn } from '@/lib/cn';
import { CollapseFade } from '@/ui/CollapseFade';
import { BellIcon } from '@/ui/icons';
import { LogoMarkIllustration } from '@/ui/illustrations';
import { Soon } from '@/ui/Soon';

export type SidebarHeaderProps = {
  /** The rail, as React knows it: labels and tab order only. The look is `rail:` CSS. */
  collapsed: boolean;
  hasUnread: boolean;
  onToggle: () => void;
};

export function SidebarHeader({ collapsed, hasUnread, onToggle }: SidebarHeaderProps) {
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

      <CollapseFade open="panel" className="ml-auto shrink-0" inert={collapsed || undefined}>
        <Soon>
          <button
            aria-disabled="true"
            type="button"
            aria-label={hasUnread ? 'Notifications, unread' : 'Notifications'}
            tabIndex={collapsed ? -1 : undefined}
            className="relative flex size-8 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors duration-press ease-standard hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <BellIcon className="size-[18px]" />
            {hasUnread && (
              <span className="absolute right-1.5 top-1.5 size-[5px] rounded-full bg-danger-dot transition-opacity duration-fast ease-standard starting:opacity-0" />
            )}
          </button>
        </Soon>
      </CollapseFade>
    </div>
  );
}
