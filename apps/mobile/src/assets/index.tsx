import type { ReactElement } from 'react';
import type { ImageSourcePropType } from 'react-native';
import type { SvgProps } from 'react-native-svg';

import AdobeLogo from '../../assets/logos/adobe.svg';
import GoogleLogo from '../../assets/logos/google.svg';

/**
 * Local asset registry. Domain data references images by an `asset:<key>` URL so the mock
 * layer stays plain strings (the real API will return https URLs); the UI resolves keys here.
 */
const ASSET_SCHEME = 'asset:';

const mockImages: Record<string, ImageSourcePropType> = {
  'avatar-george': require('../../assets/mock/avatar-george.png'),
  'resume-thumb': require('../../assets/mock/resume-thumb.png'),
};

/** Render functions (not components) so callers can invoke them inline without creating components during render. */
export type LogoRenderer = (props: SvgProps) => ReactElement;

const brandLogos: Record<string, LogoRenderer> = {
  'logo-google': (props) => <GoogleLogo {...props} />,
  'logo-adobe': (props) => <AdobeLogo {...props} />,
};

export const assetKey = (key: string): string => `${ASSET_SCHEME}${key}`;

const keyOf = (url: string): string | null =>
  url.startsWith(ASSET_SCHEME) ? url.slice(ASSET_SCHEME.length) : null;

/** Resolves an image URL (remote or `asset:` key) to an expo-image / RN Image source. */
export function resolveImageSource(url: string | undefined): ImageSourcePropType | undefined {
  if (!url) return undefined;
  const key = keyOf(url);
  if (key == null) return { uri: url };
  return mockImages[key];
}

/** Resolves a company logo URL to a bundled SVG renderer when one exists. */
export function resolveLogoSvg(url: string | undefined): LogoRenderer | undefined {
  if (!url) return undefined;
  const key = keyOf(url);
  return key == null ? undefined : brandLogos[key];
}
