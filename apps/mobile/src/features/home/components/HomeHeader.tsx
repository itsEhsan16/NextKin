import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { IconButton } from '@/ui/IconButton';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';

export type HomeHeaderProps = {
  firstName?: string;
  avatarUrl?: string;
  loading?: boolean;
  hasUnread: boolean;
  onPressNotifications: () => void;
  onPressMenu: () => void;
};

/** Figma 1:3 — avatar 56, "Hi / George", bell (FA5 regular, unread dot) and menu buttons. */
export function HomeHeader({
  firstName,
  avatarUrl,
  loading = false,
  hasUnread,
  onPressNotifications,
  onPressMenu,
}: HomeHeaderProps) {
  const { spacing, sizes, s } = useTheme();
  const avatarSize = sizes.avatarHeader;

  return (
    // A floor, not a height: at phone width the avatar scales flat (42 at 390) while the two
    // buttons hold at the 44pt control floor, and a fixed row let them spill past it.
    <View style={[styles.row, { minHeight: avatarSize }]}>
      <View style={[styles.row, { gap: spacing[3] }]}>
        {loading ? (
          <Skeleton width={avatarSize} height={avatarSize} radius="full" />
        ) : (
          <Avatar source={avatarUrl} name={firstName ?? ''} size={avatarSize} />
        )}
        <View accessible accessibilityRole="header" accessibilityLabel={`Hi ${firstName ?? ''}`}>
          <Text variant="greetingLabel" color="textSecondary">
            Hi
          </Text>
          {loading ? (
            <Skeleton width={s(84)} height={s(20)} style={{ marginTop: s(4) }} />
          ) : (
            <Text variant="greeting" numberOfLines={1}>
              {firstName}
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.row, { gap: spacing[3] }]}>
        <IconButton
          icon="Bell01"
          label={hasUnread ? 'Notifications, unread' : 'Notifications'}
          dot={hasUnread}
          onPress={onPressNotifications}
        />
        <IconButton icon="Menu01" label="Menu" onPress={onPressMenu} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
