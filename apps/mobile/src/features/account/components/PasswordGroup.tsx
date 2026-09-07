import { useRef } from 'react';
import { View, type TextInput } from 'react-native';

import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { RowGroup } from '@/ui/ListRow';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { PASSWORD_NOTE, type PasswordDraft } from '../accountForms';
import { AccountStatusLine } from './AccountStatusLine';

export const CHANGE_PASSWORD = 'Change password';

export type PasswordGroupProps = {
  draft: PasswordDraft;
  /** Only the messages that have earned their place — see the screen's `touched`/`refused`. */
  errors: Record<string, string>;
  onChange: (key: keyof PasswordDraft, value: string) => void;
  onBlurField: (key: keyof PasswordDraft) => void;
  status?: { message: string; tone?: 'neutral' | 'danger' };
  busy: boolean;
  disabled: boolean;
  onSubmit: () => void;
};

/**
 * V2 §7.1 / §8.4 — the three boxes that change a password. The app proxies the change to the
 * identity provider and never verifies anything itself, which is why the only rules enforced
 * here are the ones a device can actually check; whether the current password is right comes
 * back as the mutation's rejection.
 *
 * Chained with `returnKeyType="next"` and refs (React 19 passes `ref` as a plain prop), so the
 * keyboard's Next key walks the form instead of dismissing itself between every field.
 */
export function PasswordGroup({
  draft,
  errors,
  onChange,
  onBlurField,
  status,
  busy,
  disabled,
  onSubmit,
}: PasswordGroupProps) {
  const { spacing } = useTheme();

  const nextRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  return (
    <RowGroup title="PASSWORD">
      <View style={{ padding: spacing[4], gap: spacing[4] }}>
        <TextField
          label="Current password"
          value={draft.current}
          onChangeText={(value) => onChange('current', value)}
          onBlur={() => onBlurField('current')}
          error={errors.current}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          returnKeyType="next"
          onSubmit={() => nextRef.current?.focus()}
        />

        <TextField
          ref={nextRef}
          label="New password"
          value={draft.next}
          onChangeText={(value) => onChange('next', value)}
          onBlur={() => onBlurField('next')}
          error={errors.next}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          returnKeyType="next"
          onSubmit={() => confirmRef.current?.focus()}
        />

        <TextField
          ref={confirmRef}
          label="Confirm new password"
          value={draft.confirm}
          onChangeText={(value) => onChange('confirm', value)}
          onBlur={() => onBlurField('confirm')}
          error={errors.confirm}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          returnKeyType="done"
          onSubmit={onSubmit}
        />

        <Button
          label={CHANGE_PASSWORD}
          variant="secondary"
          loading={busy}
          disabled={disabled}
          onPress={onSubmit}
          block
        />

        {status ? <AccountStatusLine message={status.message} tone={status.tone} /> : null}

        <Text variant="caption" color="textTertiary">
          {PASSWORD_NOTE}
        </Text>
      </View>
    </RowGroup>
  );
}
