import { View } from 'react-native';

import { useTheme } from '@/theme';
import { ListRow, RowGroup } from '@/ui/ListRow';
import { Text } from '@/ui/Text';

import { AccountStatusLine } from './AccountStatusLine';

export const SIGN_OUT_EVERYWHERE = 'Sign out everywhere';

/** Said before the press, not after it: this device is one of the sessions being revoked. */
const CAPTION =
  'Signs every device out of this account, including this one. Use it if you have signed in somewhere you no longer have.';

export type SessionsGroupProps = {
  status?: { message: string; tone?: 'neutral' | 'danger' };
  onSignOutEverywhere: () => void;
};

/** V2 §7.1 — the session half of the account screen: one row, and what it costs you. */
export function SessionsGroup({ status, onSignOutEverywhere }: SessionsGroupProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing[3] }}>
      <RowGroup title="SESSIONS">
        <ListRow
          icon="sign-out-alt"
          label={SIGN_OUT_EVERYWHERE}
          tone="danger"
          showChevron={false}
          accessibilityHint="Asks to confirm"
          onPress={onSignOutEverywhere}
        />
      </RowGroup>
      <Text variant="caption" color="textSecondary">
        {CAPTION}
      </Text>
      {status ? <AccountStatusLine message={status.message} tone={status.tone} /> : null}
    </View>
  );
}
