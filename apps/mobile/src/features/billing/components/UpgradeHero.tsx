import { View } from 'react-native';

import PlanMarkIcon from '../../../../assets/icons/profile/plan-mark.svg';
import { Art } from '@/features/profile/components/cards';
import { a11yHeader } from '@/lib';
import { scaledSheet } from '@/theme';
import type { ListRowArt } from '@/ui/ListRow';
import { Text } from '@/ui/Text';

// BILLING 01 hero at 390 (577:9162), in artboard units.
const MARK_W = 30;
const MARK_GAP = 8 / 0.75;
const TITLE_TO_CAPTION = 8 / 0.75;

/** The sparkle mark beside the wordmark (577:9165) — the same drawing as Profile's plan mark. */
const SPARKLE_MARK: ListRowArt = { Icon: PlanMarkIcon, w: 39, h: 40.5294 };

/**
 * The page's own title: the sparkle mark, "NextKin Pro" and one line on what the page is for.
 * The board's IL-B1 illustration slot (577:9172) has no drawing yet, so the title leads alone.
 */
export function UpgradeHero({ title, caption }: { title: string; caption: string }) {
  const styles = useStyles();

  return (
    <View>
      <View style={styles.wordmark}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Art art={SPARKLE_MARK} width={MARK_W} />
        </View>
        <Text {...a11yHeader(title)} variant="displayLg" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      </View>
      <Text variant="captionRegular" color="textSecondary" style={styles.caption}>
        {caption}
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: s(MARK_GAP) },
  title: { flexShrink: 1 },
  caption: { marginTop: s(TITLE_TO_CAPTION) },
}));
