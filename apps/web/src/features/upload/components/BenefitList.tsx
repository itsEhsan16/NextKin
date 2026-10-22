import type { ComponentType, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import {
  JdArtBookmarkIllustration,
  JdArtDocumentSearchIllustration,
  ProfileGoalsIllustration,
  ProfileSkillsIllustration,
  SettingsLightbulbIllustration,
  SettingsMatchScoreIllustration,
  SettingsSecurityIllustration,
} from '@/ui/illustrations';

import type { Benefit, BenefitIcon } from '../uploadLibrary';

type Glyph = ComponentType<SVGProps<SVGSVGElement>>;

/** The duotone glyphs, which carry their own colours and sit on no disc (361:1264). */
const ART: Partial<Record<BenefitIcon, Glyph>> = {
  artDocumentSearch: JdArtDocumentSearchIllustration,
  artMatchScore: SettingsMatchScoreIllustration,
  artLightbulb: SettingsLightbulbIllustration,
  artBookmark: JdArtBookmarkIllustration,
};

/** The link board's duotone glyphs, which keep a lavender disc behind them (361:1125-1156). */
const DISC_ART: Partial<Record<BenefitIcon, Glyph>> = {
  discBolt: ProfileSkillsIllustration,
  discDocumentSearch: JdArtDocumentSearchIllustration,
  discGoals: ProfileGoalsIllustration,
  discLock: SettingsSecurityIllustration,
};

/**
 * A side column's four reasons, each a duotone glyph beside a title and a line (361:1264,
 * 361:1124-1155, 361:1544-1581). The link column keeps a lavender disc behind its glyphs; the
 * paste and upload columns draw theirs bare.
 */
export function BenefitList({
  items,
  roomy = false,
  className,
}: {
  items: readonly Benefit[];
  /** The link column's larger rows (361:1124): 62px discs, a 16px title over a 14px line. */
  roomy?: boolean;
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {items.map((item) => {
        const Art = ART[item.icon];
        const DiscArt = DISC_ART[item.icon];
        return (
          <li
            key={item.title}
            className={cn('flex gap-3', roomy ? 'items-start gap-5' : 'items-center')}
          >
            {DiscArt ? (
              <span
                aria-hidden
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-full bg-linear-135 from-surface-brand-strong to-surface-brand',
                  roomy ? 'size-15.5' : 'size-14',
                )}
              >
                <DiscArt className={cn('h-auto', roomy ? 'max-h-10 w-11' : 'max-h-8 w-9')} />
              </span>
            ) : (
              Art && (
                <span aria-hidden className="flex w-10 shrink-0 justify-center">
                  <Art className="h-auto max-h-9 w-10" />
                </span>
              )
            )}
            <span className={cn('min-w-0', roomy && 'pt-1')}>
              <span
                className={cn(
                  'block font-semibold text-text-primary',
                  roomy ? 'text-title-l' : 'text-body-m',
                )}
              >
                {item.title}
              </span>
              <span
                className={cn(
                  'block text-text-secondary',
                  roomy ? 'mt-0.5 text-prose' : 'text-body-s',
                )}
              >
                {item.line}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
