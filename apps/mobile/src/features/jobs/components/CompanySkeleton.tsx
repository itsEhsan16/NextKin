import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

// JOBS 09 at 390 (580:1648), in artboard units — each block the height of what replaces it.
const LOGO = 68 / 0.75;
const LOGO_TO_NAME = 14 / 0.75;
const NAME = 27 / 0.75;
const META = 16 / 0.75;
const HERO_TO_WEBSITE = 18 / 0.75;
const WEBSITE = 57.5 / 0.75;
const WEBSITE_TO_ABOUT = 14 / 0.75;
const ABOUT = 188.5 / 0.75;
const ABOUT_TO_ROLES = 26 / 0.75;
const HEADING = 21 / 0.75;
const HEADING_W = 180 / 0.75;
const HEADING_TO_ROLES = 12 / 0.75;
const ROLE_CARD = 191.5 / 0.75;

/**
 * Loading shape of the company screen (JOBS 09): the centred hero, the website card, the About
 * card and one open-role card, so nothing jumps when the data lands.
 */
export function CompanySkeleton() {
  const { spacing, s } = useTheme();
  const styles = useStyles();

  return (
    <View accessible accessibilityLabel="Loading company">
      {/* The centred logo, name and meta, in the hero's height (§196). */}
      <View
        style={[
          styles.hero,
          { height: s(LOGO) + s(LOGO_TO_NAME) + s(NAME) + spacing[1] + s(META) },
        ]}
      >
        <Skeleton width={s(LOGO)} height={s(LOGO)} radius="xxl" />
        <Skeleton
          width="55%"
          height={s(NAME) * 0.8}
          radius="full"
          style={{ marginTop: s(LOGO_TO_NAME) }}
        />
        <Skeleton width="35%" height={s(META)} radius="full" style={{ marginTop: spacing[1] }} />
      </View>
      <Skeleton height={s(WEBSITE)} radius="cardLg" style={styles.website} />
      <Skeleton height={s(ABOUT)} radius="cardLg" style={styles.about} />
      <Skeleton width={s(HEADING_W)} height={s(HEADING)} style={styles.heading} />
      <Skeleton height={s(ROLE_CARD)} radius="cardLg" style={styles.role} />
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  hero: { alignItems: 'center' },
  name: { marginTop: s(LOGO_TO_NAME) },
  website: { marginTop: s(HERO_TO_WEBSITE) },
  about: { marginTop: s(WEBSITE_TO_ABOUT) },
  heading: { marginTop: s(ABOUT_TO_ROLES) },
  role: { marginTop: s(HEADING_TO_ROLES) },
}));
