import { cn } from '@/lib/cn';
import { initialsOf } from '@/lib/format';
import { logoFillsTile, resolveLogo } from '@/ui/assets';

export type CompanyLogoProps = {
  company: string;
  /** The job's `companyLogoUrl`: an `asset:` key resolved through `@/ui/assets`. */
  logoUrl?: string;
  /**
   * `tile`: a list row's framed 44px square with a 26px mark inside (304:2452, 286:1313).
   * `card`: the redrawn job card's framed 40px square with a 23px mark (719:4).
   * `plain`: a detail card's bare 32px mark, no frame (304:2681, 286:1552).
   * `inline`: a bare 24px mark beside a line of text, a role on the resume preview (304:3355).
   */
  variant: 'tile' | 'card' | 'plain' | 'inline';
};

const FRAMED = {
  tile: { box: 'size-11', mark: 'size-[26px]' },
  card: { box: 'size-10', mark: 'size-[23px]' },
} as const;

const BARE: Record<Exclude<CompanyLogoProps['variant'], keyof typeof FRAMED>, string> = {
  plain: 'size-8',
  inline: 'size-6',
};

/**
 * One logo, two framings, shared by the Jobs and Applications lists and detail cards. The mark
 * comes from the job's own `companyLogoUrl`, not from matching the company's name; a company with
 * no bundled logo gets its initials on a brand tint instead. A logo the board draws as its own
 * coloured tile (Notion and Flipkart on 286:1234) is the tile, so it fills the frame's place.
 */
export function CompanyLogo({ company, logoUrl, variant }: CompanyLogoProps) {
  const renderLogo = resolveLogo(logoUrl);
  const framed = variant === 'tile' || variant === 'card' ? FRAMED[variant] : null;
  const size = framed ? framed.box : BARE[variant as keyof typeof BARE];

  if (renderLogo && logoFillsTile(logoUrl)) return renderLogo({ className: cn('shrink-0', size) });
  if (renderLogo && !framed) return renderLogo({ className: cn('shrink-0', size) });

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md',
        size,
        framed && 'border border-border-subtle bg-surface-card',
      )}
    >
      {renderLogo ? (
        renderLogo({ className: framed?.mark })
      ) : (
        <span
          aria-hidden
          className="flex size-full items-center justify-center rounded-md bg-surface-brand text-caption-m font-semibold text-text-brand"
        >
          {initialsOf(company)}
        </span>
      )}
    </div>
  );
}
