import {
  SourceAmazonIllustration,
  SourceGlassdoorIllustration,
  SourceGoogleIllustration,
  SourceIndeedIllustration,
  SourceLinkedinIllustration,
  SourceMicrosoftIllustration,
  SourceWellfoundIllustration,
} from '@/ui/illustrations';

import type { SourceName } from '../uploadLibrary';

/**
 * A job source's mark. The link board drew these clipped (`toreview.md` §23) and no longer draws
 * them, so they are the brands' own marks from Iconify's CC0 sets, as `SOURCES.json` beside them
 * records: LinkedIn, Google and Microsoft in full colour, Indeed, Glassdoor, Wellfound and Amazon
 * in their brand colours (`toreview.md` §27).
 */
export function SourceLogo({ name, className }: { name: SourceName; className: string }) {
  switch (name) {
    case 'linkedin':
      return <SourceLinkedinIllustration className={className} />;
    case 'indeed':
      return <SourceIndeedIllustration className={className} />;
    case 'glassdoor':
      return <SourceGlassdoorIllustration className={className} />;
    case 'wellfound':
      return <SourceWellfoundIllustration className={className} />;
    case 'google':
      return <SourceGoogleIllustration className={className} />;
    case 'microsoft':
      return <SourceMicrosoftIllustration className={className} />;
    case 'amazon':
      return <SourceAmazonIllustration className={className} />;
  }
}
