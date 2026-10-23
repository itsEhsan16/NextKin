import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Art } from '@/features/profile/components/cards';
import { a11yHeader } from '@/lib';
import { useTheme } from '@/theme';
import type { ListRowArt } from '@/ui/ListRow';
import { Text } from '@/ui/Text';

export type SupportHeroProps = {
  art: ListRowArt;
  /** The drawing's width in artboard units, as the other heroes draw theirs (its ratio is kept). */
  artWidth: number;
  /** Drawing → title, in artboard units — 12 on SUPPORT 01 and LEGAL, 14 on SUPPORT 02. */
  artGap: number;
  title: string;
  /** What sits under the title: a lede line, the legal stamp and intro, or a skeleton. */
  children?: ReactNode;
};

/**
 * The centred hero the Support and Legal boards open on (SUPPORT 01 577:6152, SUPPORT 02 577:7886,
 * LEGAL 01 577:8884, LEGAL 02 580:10): the Profile row drawing at hero size, then the page's name
 * in `headlineLg`. The header row above leaves its title slot empty, so this title is the page's
 * one header.
 */
export function SupportHero({ art, artWidth, artGap, title, children }: SupportHeroProps) {
  const { s } = useTheme();

  return (
    <View style={{ alignItems: 'center' }}>
      <Art art={art} width={artWidth} />
      <Text {...a11yHeader()} variant="headlineLg" align="center" style={{ marginTop: s(artGap) }}>
        {title}
      </Text>
      {children}
    </View>
  );
}
