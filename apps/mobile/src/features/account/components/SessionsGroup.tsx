import { View } from 'react-native';

import { useTheme } from '@/theme';
import { ListRow, RowGroup } from '@/ui/ListRow';

import { AccountStatusLine } from './AccountStatusLine';

export const SIGN_OUT_EVERYWHERE = 'Sign out everywhere';

export type SessionsGroupProps = {
  status?: { message: string; tone?: 'neutral' | 'danger' };
  onSignOutEverywhere: () => void;
};

/**
 * V2 §7.1 — the session half of the account screen: one row, and its answer. What the press
 * costs is said in the confirm sheet the screen raises, at the moment it is being decided.
 */
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
      {status ? <AccountStatusLine message={status.message} tone={status.tone} /> : null}
    </View>
  );
}
