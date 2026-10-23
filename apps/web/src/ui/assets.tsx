import type { ReactElement, SVGProps } from 'react';

import {
  CompanyAdobeIllustration,
  CompanyAirbnbIllustration,
  CompanyAtlassianIllustration,
  CompanyFlipkartIllustration,
  CompanyGoogleIllustration,
  CompanyMicrosoftIllustration,
  CompanyNotionIllustration,
  CompanySpotifyIllustration,
  SignatureKurianIllustration,
} from './illustrations';

/**
 * The web half of the `asset:<key>` convention. Domain data names images by key so the mock layer
 * stays plain strings (the real API returns https URLs), and each app resolves the keys to what
 * *its* boards drew — mobile in `apps/mobile/src/assets`, web here. The two sets are not the same
 * artwork: the web Jobs board (304:2332) draws its own traced logos and its own avatar photo.
 */
const ASSET_SCHEME = 'asset:';

const keyOf = (url: string): string | null =>
  url.startsWith(ASSET_SCHEME) ? url.slice(ASSET_SCHEME.length) : null;

/** Served from `public/`. */
const IMAGES: Record<string, string> = {
  'avatar-george': '/avatars/george.png',
};

/**
 * A render function rather than a component, as on mobile: a component looked up during render
 * reads to React as one *created* during render, so callers invoke this inline instead.
 */
export type LogoRenderer = (props: SVGProps<SVGSVGElement>) => ReactElement;

const LOGOS: Record<string, LogoRenderer> = {
  'logo-google': (props) => <CompanyGoogleIllustration {...props} />,
  'logo-adobe': (props) => <CompanyAdobeIllustration {...props} />,
  'logo-atlassian': (props) => <CompanyAtlassianIllustration {...props} />,
  'logo-microsoft': (props) => <CompanyMicrosoftIllustration {...props} />,
  'logo-airbnb': (props) => <CompanyAirbnbIllustration {...props} />,
  // The Applications board's other three (286:1462, 286:1493, 286:1522).
  'logo-spotify': (props) => <CompanySpotifyIllustration {...props} />,
  'logo-notion': (props) => <CompanyNotionIllustration {...props} />,
  'logo-flipkart': (props) => <CompanyFlipkartIllustration {...props} />,
};

/** Other drawings a record names by key: the certificate's signature (286:2272). */
const DRAWINGS: Record<string, LogoRenderer> = {
  'signature-kurian': (props) => <SignatureKurianIllustration {...props} />,
};

/** Logos the board draws as their own coloured tile (286:1493, 286:1522), not a mark on white. */
const TILE_LOGOS = new Set(['logo-notion', 'logo-flipkart']);

/** An image URL — remote, or an `asset:` key — as something an `<img src>` can load. */
export function resolveImageSrc(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const key = keyOf(url);
  return key == null ? url : IMAGES[key];
}

/** A company logo URL as a bundled SVG, when one exists; callers fall back to initials. */
export function resolveLogo(url: string | undefined): LogoRenderer | undefined {
  const key = url ? keyOf(url) : null;
  return key == null ? undefined : LOGOS[key];
}

/** A drawing's `asset:` key as its bundled SVG, when one exists. */
export function resolveDrawing(url: string | undefined): LogoRenderer | undefined {
  const key = url ? keyOf(url) : null;
  return key == null ? undefined : DRAWINGS[key];
}

/** Whether a logo is drawn as a whole tile, so it takes the frame's place rather than sitting in it. */
export function logoFillsTile(url: string | undefined): boolean {
  const key = url ? keyOf(url) : null;
  return key != null && TILE_LOGOS.has(key);
}
