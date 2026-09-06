import { View, type StyleProp, type ViewStyle } from 'react-native';

import { pluralize } from '@/lib';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

export type UsageBannerProps = {
  /** How much of this month's allowance is already spent. */
  used: number;
  /** The published cap. A non-positive limit means "nothing to meter" and renders nothing. */
  limit: number;
  /** Singular noun for the metered thing: 'generation', 'cover letter', 'ATS check'. */
  noun: string;
  /** The period the cap is over. Every §13.3 meter is monthly except the assistant's. */
  period?: 'month' | 'day';
  style?: StyleProp<ViewStyle>;
};

const PERIOD_SUFFIX: Record<'month' | 'day', string> = { month: 'this month', day: 'today' };

/** Matches the resume usage meter (Figma 1:1393): amber fill on the neutral track. */
const BAR_HEIGHT = 4;

/**
 * "1 of 3 generations left this month" over the amber usage bar.
 *
 * V2 §13.5 wants the cap in front of the user BEFORE the work starts, which is why every create
 * screen opens with this card instead of raising the limit as an error once the work is done.
 * The counts arrive as props — the screen above reads them off `useSubscription()` — so the same
 * card meters cover letters and ATS checks without knowing which quota it is drawing.
 *
 * The bar is hidden from the reader: the line above it already says the number, and a progressbar
 * repeating it is a second stop that adds nothing.
 */
export function UsageBanner({ used, limit, noun, period = 'month', style }: UsageBannerProps) {
  const { spacing, s } = useTheme();

  if (limit <= 0) return null;

  const left = Math.max(0, limit - used);
  const line = `${left} of ${pluralize(limit, noun)} left ${PERIOD_SUFFIX[period]}`;

  return (
    <Card radius="card" style={style}>
      <View style={{ gap: spacing[3] }}>
        <Text variant="caption" color="textSecondary">
          {line}
        </Text>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ProgressBar
            value={used / limit}
            height={s(BAR_HEIGHT)}
            trackColor="progressTrack"
            fillColor="warningAccent"
          />
        </View>
      </View>
    </Card>
  );
}
