import { View } from 'react-native';

import { SectionCard } from '@/features/profile/components/cards';
import { PROFILE_ROW_ART } from '@/features/profile/profileRowArt';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { EMAIL_HELPER } from '../accountForms';
import { AccountStatusLine } from './AccountStatusLine';

const GROUP_TITLE = 'Email';
export const SEND_VERIFICATION = 'Send verification';

// ACCOUNT 01 "Email" card at 390 (577:2487), in artboard units.
const CURRENT_LINE_GAP = 3 / 0.75;
/** Skeleton blocks: the current-address pair, the labelled field with its helper, the button. */
const CURRENT_ROW = 38 / 0.75;
const FIELD_BLOCK = 108 / 0.75;
const BUTTON = 48 / 0.75;

export type EmailGroupProps = {
  currentEmail: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  /** Only a message that has earned its place — see the screen's `touched`. */
  error?: string;
  status?: { message: string; tone?: 'neutral' | 'danger' };
  busy: boolean;
  disabled: boolean;
  onSend: () => void;
};

/**
 * V2 §7.1 — changing the address the account signs in with. The current address is shown rather
 * than pre-filled into the field: an editable box holding what you already have invites a typo
 * into the one value you need in order to get back in.
 */
export function EmailGroup({
  currentEmail,
  value,
  onChange,
  onBlur,
  error,
  status,
  busy,
  disabled,
  onSend,
}: EmailGroupProps) {
  const { colors, s } = useTheme();

  return (
    <SectionCard art={PROFILE_ROW_ART.contact} title={GROUP_TITLE}>
      <View
        accessible
        accessibilityLabel={`Current address, ${currentEmail}`}
        style={{ gap: s(CURRENT_LINE_GAP) }}
      >
        <Text variant="micro" color="textSecondary">
          Current address
        </Text>
        <Text variant="menuRow">{currentEmail}</Text>
      </View>

      <View style={{ height: 1, backgroundColor: colors.divider }} />

      <TextField
        label="New email address"
        placeholder="you@example.com"
        icon="envelope"
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        error={error}
        helper={EMAIL_HELPER}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        returnKeyType="done"
        onSubmit={onSend}
      />

      <Button
        label={SEND_VERIFICATION}
        variant="secondary"
        loading={busy}
        disabled={disabled}
        onPress={onSend}
        block
      />

      {status ? <AccountStatusLine message={status.message} tone={status.tone} /> : null}
    </SectionCard>
  );
}

/**
 * The email group while the account is still loading. Only this group reads the user, so only
 * this group stands in — the password and session groups below it are already usable, and
 * blanking them would be a lie about what is waiting on the network.
 */
export function EmailGroupSkeleton() {
  const { spacing, s } = useTheme();

  return (
    <SectionCard art={PROFILE_ROW_ART.contact} title={GROUP_TITLE}>
      <View accessible accessibilityLabel="Loading your account" style={{ gap: spacing[4] }}>
        <Skeleton width="60%" height={s(CURRENT_ROW)} />
        <Skeleton height={s(FIELD_BLOCK)} radius="card" />
        <Skeleton height={s(BUTTON)} radius="xl" />
      </View>
    </SectionCard>
  );
}
