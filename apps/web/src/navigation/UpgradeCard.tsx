import Link from 'next/link';

import { cn } from '@/lib/cn';
import { CollapseFade } from '@/ui/CollapseFade';
import { NavUpgradeIllustration } from '@/ui/illustrations';
import { primaryButton } from '@/ui/primaryButton';
import { RailTooltip } from '@/ui/RailTooltip';

import { NavGlyph } from './NavGlyph';

/**
 * Settings → Billing & plan, where both plans are laid out. It pointed at `/upgrade`, a
 * coming-soon page that sends the user back to Billing (audit ST-08).
 */
const UPGRADE_HREF = '/settings?tab=billing' as never;

/** `collapsed` is the rail as React knows it: tab order and the tooltip. The look is `rail:` CSS. */
export function UpgradeCard({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="w-full">
      {/* Collapsed: the icon itself is "Upgrade to Pro". Kept as a real, always-present link
          (rather than swapped in) so the cross-fade against the expanded card below animates —
          `inert` takes it out of tab order and the accessibility tree while the panel is open. */}
      <CollapseFade axis="vertical" open="rail" inert={collapsed ? undefined : true}>
        <RailTooltip label="Upgrade to Pro" enabled={collapsed}>
          <Link
            href={UPGRADE_HREF}
            aria-label="Upgrade to Pro"
            tabIndex={collapsed ? undefined : -1}
            // `mx-auto` unconditionally: this Link is only ever visible while its own CollapseFade
            // is open (collapsed=true), so it never needs to differ by state the way the header's
            // logo button does — it just always centres in whatever width its row currently has,
            // matching every other rail icon's position on the same hit-target column.
            className="mx-auto flex size-10 items-center justify-center rounded-md transition-colors duration-press ease-standard hover:bg-surface-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {/* Through `NavGlyph`, so the crown is the same width as every rail icon above it. */}
            <NavGlyph Icon={NavUpgradeIllustration} />
          </Link>
        </RailTooltip>
      </CollapseFade>

      {/* Expanded: the informational card, with its own separate CTA link. `inert` while the
          rail is collapsed for the same reason as above. */}
      <CollapseFade axis="vertical" open="panel" inert={collapsed ? true : undefined}>
        <div className="flex w-[200px] flex-col gap-2.5 rounded-lg bg-surface-brand p-3">
          <div className="flex gap-2">
            {/* 711:2 draws the crown 22 wide against the rows' 24, so it sits a step under them. */}
            <span className="mt-0.5 shrink-0">
              <NavUpgradeIllustration className="h-auto w-9" />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-body-m font-semibold text-text-brand">Upgrade to Pro</span>
              {/* What gives way on a short window (`short` in theme.css): the rows above need the
                  room more than this line does, and the title and button still say what it is. */}
              <span className="text-micro text-text-tertiary short:hidden">
                Unlimited generations, DOCX export and priority processing.
              </span>
            </div>
          </div>
          <Link
            href={UPGRADE_HREF}
            tabIndex={collapsed ? -1 : undefined}
            className={cn(primaryButton, 'h-8 w-full rounded-md text-body-s')}
          >
            Upgrade Now
          </Link>
        </div>
      </CollapseFade>
    </div>
  );
}
