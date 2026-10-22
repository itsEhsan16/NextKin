import { View } from 'react-native';

import ProPlanArt from '../../../../assets/icons/billing/pro-plan.svg';
import { Art, ProfileCard } from '@/features/profile/components/cards';
import { scaledSheet, useTheme } from '@/theme';
import type { ListRowArt } from '@/ui/ListRow';
import { Text } from '@/ui/Text';

import { MANAGE_NOTE, PRO_TITLE } from '../upgradeCopy';

export type ProStatusCardProps = {
  /** "Renews on 12 Oct", or nothing when the subscription carries no renewal date. */
  renewal?: string;
};

// The plan cards' lead slot (BILLING 01 577:9267), in artboard units.
const ROW_GAP = 12 / 0.75;
const ICON_SLOT_W = 44 / 0.75;
const ICON_SLOT_H = 38 / 0.75;
const ART_W = 40;
const TEXT_GAP = 4 / 0.75;

const PRO_ART: ListRowArt = { Icon: ProPlanArt, w: 40, h: 32.4917 };

/**
 * What the plan screen becomes once there is nothing to sell. A reader already on Pro is shown
 * where they stand and how to change it — never a second pitch for the plan they are paying for.
 * No board draws this state, so it borrows the Pro plan card's crown and lavender wash (577:9259).
 */
export function ProStatusCard({ renewal }: ProStatusCardProps) {
  const { colors, spacing } = useTheme();
  const styles = useStyles();

  return (
    <ProfileCard
      style={{
        padding: spacing[5],
        borderColor: colors.brandBorder,
        backgroundColor: colors.brandSurface,
      }}
    >
      <View style={styles.row}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.iconSlot}
        >
          <Art art={PRO_ART} width={ART_W} />
        </View>
        <View style={styles.text}>
          <Text variant="title">{PRO_TITLE}</Text>
          <Text variant="micro" color="textSecondary">
            {renewal ?? MANAGE_NOTE}
          </Text>
        </View>
      </View>
    </ProfileCard>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: s(ROW_GAP) },
  iconSlot: {
    width: s(ICON_SLOT_W),
    height: s(ICON_SLOT_H),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: s(TEXT_GAP) },
}));
