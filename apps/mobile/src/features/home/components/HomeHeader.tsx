import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { Pressable } from '@/ui/Pressable';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';

export type HomeHeaderProps = {
  firstName?: string;
  avatarUrl?: string;
  loading?: boolean;
  hasUnread: boolean;
  onPressNotifications: () => void;
  onPressMenu: () => void;
  /** The avatar and greeting: the way into Profile since it left the bottom bar (§195). */
  onPressProfile?: () => void;
  /** The search pill: opens the Jobs tab. Absent while the page is loading. */
  onSearch?: () => void;
  /** For tests: the hour the greeting is chosen by. */
  now?: Date;
};

/** "Good morning" before noon, "Good afternoon" to six, "Good evening" after. */
export function greetingFor(now: Date): string {
  const hour = now.getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

/**
 * Home's top (toreview §176): the avatar and a greeting, the bell and the menu, then one big line
 * and a search pill, all on the lavender wash. It replaces the logo block, the "Build better. Land
 * faster." slogan and the black Find Jobs tile; the search pill is the way into Jobs now.
 */
export function HomeHeader({
  firstName,
  avatarUrl,
  loading = false,
  hasUnread,
  onPressNotifications,
  onPressMenu,
  onPressProfile,
  onSearch,
  now = new Date(),
}: HomeHeaderProps) {
  const { colors, sizes, u } = useTheme();
  const styles = useStyles();
  const avatarSize = sizes.avatarHeader;
  const greeting = greetingFor(now);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          feedback="subtle"
          accessibilityRole="button"
          accessibilityLabel={`${greeting}, ${firstName ?? ''}. Your profile`}
          accessibilityHint="Opens your profile"
          disabled={!onPressProfile || loading}
          dimDisabled={false}
          onPress={onPressProfile}
          style={[styles.row, styles.who]}
        >
          {loading ? (
            <Skeleton width={avatarSize} height={avatarSize} radius="full" />
          ) : (
            <Avatar source={avatarUrl} name={firstName ?? ''} size={avatarSize} />
          )}
          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel={`${greeting}, ${firstName ?? ''}`}
            style={styles.flex}
          >
            <Text variant="footnote" color="textSecondary">
              {greeting}
            </Text>
            {loading ? (
              <Skeleton width={u(84)} height={u(20)} style={{ marginTop: u(4) }} />
            ) : (
              <Text variant="title3" color="ink" numberOfLines={1}>
                {firstName}
              </Text>
            )}
          </View>
        </Pressable>
        <View style={[styles.row, styles.actions]}>
          <IconButton
            icon="Bell01"
            label={hasUnread ? 'Notifications, unread' : 'Notifications'}
            variant="outline"
            dot={hasUnread}
            onPress={onPressNotifications}
          />
          <IconButton icon="Menu01" label="Menu" variant="outline" onPress={onPressMenu} />
        </View>
      </View>

      <Text variant="title1" color="ink" style={styles.title}>
        Let’s land your next role.
      </Text>
      {onSearch ? (
        <Pressable
          feedback="subtle"
          accessibilityRole="button"
          accessibilityLabel="Find Jobs"
          accessibilityHint="Opens the Jobs tab"
          onPress={onSearch}
          style={[
            styles.search,
            { backgroundColor: colors.surfaceCard, borderColor: colors.borderSoft },
          ]}
        >
          <Icon name="SearchLg" size={u(20)} color={colors.textSecondary} />
          <Text variant="bodyLg" color="textTertiary" style={styles.flex} numberOfLines={1}>
            Search jobs, companies, roles
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  wrap: { paddingTop: u(8), paddingBottom: u(4), gap: u(16) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  who: { flex: 1, gap: u(12), justifyContent: 'flex-start' },
  actions: { gap: u(10) },
  flex: { flex: 1 },
  title: { marginTop: u(8) },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(10),
    height: u(54),
    paddingHorizontal: u(18),
    borderRadius: u(999),
    borderWidth: 1,
  },
}));
