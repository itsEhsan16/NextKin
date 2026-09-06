import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';

export type AvatarPickerRowProps = {
  name: string;
  /** Remote URL, `asset:` key, or the local URI the picker just handed back. */
  source?: string;
  /** The write is in flight: the button spins and refuses a second pick. */
  busy?: boolean;
  /** Replaces the helper line and paints it in the danger tone. */
  error?: string;
  onPick: () => void;
};

/** Between the 56 the header wears and the 88 the completeness ring frames. */
const AVATAR = 72;

const HELPER = 'Saves as soon as you pick it — no need to press Save.';

/**
 * The photo row at the top of "Edit profile" (V2 §7.3). The picture is the only field on the page
 * that does not wait for Save, and the helper line says so, because a control that behaves
 * differently from the five below it has to admit that on screen rather than in a code comment.
 */
export function AvatarPickerRow({
  name,
  source,
  busy = false,
  error,
  onPick,
}: AvatarPickerRowProps) {
  const { spacing, s } = useTheme();

  return (
    <Card radius="card">
      <View style={[styles.row, { gap: spacing[4] }]}>
        <Avatar name={name} source={source} size={s(AVATAR)} />
        <View style={[styles.details, { gap: spacing[2] }]}>
          <Button
            label="Change photo"
            variant="secondary"
            icon="camera"
            loading={busy}
            onPress={onPick}
          />
          <Text
            variant="caption"
            color={error ? 'danger' : 'textSecondary'}
            accessibilityLiveRegion="polite"
          >
            {error ?? HELPER}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  details: { flex: 1 },
});
