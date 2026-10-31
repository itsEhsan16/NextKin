import { View } from 'react-native';

import { ProfileCard } from '@/features/profile/components/cards';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';

import { SESSIONS_NOTE } from '../accountForms';
import { AccountStatusLine } from './AccountStatusLine';
import { Icon } from '@/ui/Icon';

export const SIGN_OUT_EVERYWHERE = 'Sign out everywhere';

// ACCOUNT 01 "Sessions" card at 390 (577:2562), in artboard units.
const HEADER_GAP = 10 / 0.75;
const TILE = 32 / 0.75;
const TILE_RADIUS = 9 / 0.75;
const TITLE_GAP = 1 / 0.75;

export type SessionsGroupProps = {
  status?: { message: string; tone?: 'neutral' | 'danger' };
  onSignOutEverywhere: () => void;
};

/**
 * V2 §7.1 — the session half of the account screen: a laptop tile, what the press costs, and the
 * red outlined button. The confirm sheet the screen raises repeats the cost at the moment it is
 * being decided.
 */
export function SessionsGroup({ status, onSignOutEverywhere }: SessionsGroupProps) {
  const { colors, spacing } = useTheme();
  const styles = useStyles();

  return (
    <ProfileCard style={{ padding: spacing[5], gap: spacing[4] }}>
      <View style={styles.header}>
        <View style={[styles.tile, { backgroundColor: colors.tileBrandStrong }]}>
          <Icon name="Laptop01" size="sm" color={colors.brand} />
        </View>
        <View style={styles.titles}>
          <Text {...a11yHeader()} variant="title">
            Sessions
          </Text>
          <Text variant="micro" color="textSecondary">
            {SESSIONS_NOTE}
          </Text>
        </View>
      </View>

      <Button
        label={SIGN_OUT_EVERYWHERE}
        variant="dangerOutline"
        icon="LogOut01"
        onPress={onSignOutEverywhere}
        block
      />

      {status ? <AccountStatusLine message={status.message} tone={status.tone} /> : null}
    </ProfileCard>
  );
}

const useStyles = scaledSheet((s) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: s(HEADER_GAP) },
  tile: {
    width: s(TILE),
    height: s(TILE),
    borderRadius: s(TILE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, gap: s(TITLE_GAP) },
}));
