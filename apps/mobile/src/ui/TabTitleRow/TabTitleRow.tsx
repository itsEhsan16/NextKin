import { StyleSheet, View } from 'react-native';

import { a11yHeader } from '@/lib';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';

export type TabTitleRowProps = {
  title: string;
  hasUnread: boolean;
  onPressNotifications: () => void;
};

/**
 * The title row a titled tab wears: the screen's name, and the bell at the far end — Jobs
 * (118:3 / 118:4), Resumes (95:1528 / 95:1529) and Profile (95:2390) draw it identically.
 *
 * One component so the three cannot drift apart. The space around it is not its own: the top
 * belongs to the screen's header box (`spacing.headerTop`) and the seam under it to the row
 * that follows (`sizes.titleRowGap`).
 */
export function TabTitleRow({ title, hasUnread, onPressNotifications }: TabTitleRowProps) {
  return (
    <View style={styles.row}>
      <Text {...a11yHeader()} variant="screenTitle">
        {title}
      </Text>
      <IconButton
        icon="Bell01"
        label={hasUnread ? 'Notifications, unread' : 'Notifications'}
        dot={hasUnread}
        onPress={onPressNotifications}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
