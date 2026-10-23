import { Image } from 'expo-image';
import { View } from 'react-native';

import type { FlowArt } from '@/features/create/components/FlowHero';
import { Art } from '@/features/profile/components/cards';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import type { ListRowArt } from '@/ui/ListRow';
import { Text } from '@/ui/Text';

// ACCOUNT 01 (577:2481) and ACCOUNT 02 (577:3096) at 390, in artboard units.
const SIDE_INSET = 24 / 0.75;
const TITLE_TO_LEDE = 8 / 0.75;

export type AccountHeroProps = {
  /** Omitted where the board holds an illustration slot that has not been drawn yet. */
  art?: ListRowArt;
  /** The width the board draws the drawing at on 390 (64 on ACCOUNT 01, 72 on ACCOUNT 02). */
  artWidth?: number;
  /** Drawing → title: 14 on ACCOUNT 01, 16 on ACCOUNT 02. */
  artGap?: number;
  /** A board's raster illustration in place of the icon drawing (ACCOUNT 03's 680:92). */
  image?: FlowArt;
  title: string;
  lede: string;
};

/** The centred drawing, title and lede an account page opens on. The hero names the page. */
export function AccountHero({
  art,
  artWidth = 64,
  artGap = 14,
  image,
  title,
  lede,
}: AccountHeroProps) {
  const { motion, s } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.hero}>
      {image ? (
        <Image
          source={image.source}
          contentFit="contain"
          transition={motion.durations.imageFade}
          cachePolicy="memory-disk"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: s(image.w / 0.75),
            height: s(image.h / 0.75),
            marginBottom: s(image.toTitle / 0.75),
            transform: [{ translateX: s(image.shiftX / 0.75) }],
          }}
        />
      ) : art ? (
        <View style={{ marginBottom: s(artGap / 0.75) }}>
          <Art art={art} width={artWidth / 0.75} />
        </View>
      ) : null}
      <Text {...a11yHeader()} variant="headlineLg" align="center">
        {title}
      </Text>
      <Text variant="captionRegular" color="textSecondary" align="center" style={styles.lede}>
        {lede}
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  hero: { alignItems: 'center', paddingHorizontal: s(SIDE_INSET) },
  lede: { marginTop: s(TITLE_TO_LEDE) },
}));
