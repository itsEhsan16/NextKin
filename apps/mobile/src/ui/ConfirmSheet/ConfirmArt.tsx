import { Image } from 'expo-image';

import { useTheme } from '@/theme';

/**
 * The confirm sheets' own drawings (PROFILE 21 680:98, PROFILE 23 691:6): since §211 the clay
 * set, each fitted inside the board's box. One per question, so "Discard changes?" looks the same on every editor that asks it.
 */
const ART = {
  signOut: {
    source: require('../../../assets/illustrations/profile/sign-out.webp'),
    w: 127.6,
    h: 121,
  },
  discard: {
    source: require('../../../assets/illustrations/profile/discard.webp'),
    w: 126,
    h: 121,
  },
} as const;

export type ConfirmArtKind = keyof typeof ART;

// Both boards start the drawing 5 below the copy block's top and run it into the title (573:826).
const TOP = 5 / 0.75;

/** Goes in `ConfirmSheet`'s `art`, with `artGap={0}`: the drawing meets the title, as drawn. */
export function ConfirmArt({ kind }: { kind: ConfirmArtKind }) {
  const { motion, s } = useTheme();
  const art = ART[kind];
  return (
    <Image
      source={art.source}
      contentFit="contain"
      transition={motion.durations.imageFade}
      cachePolicy="memory-disk"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: s(art.w / 0.75), height: s(art.h / 0.75), marginTop: s(TOP) }}
    />
  );
}
