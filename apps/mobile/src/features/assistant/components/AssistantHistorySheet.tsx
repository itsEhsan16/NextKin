import { ScrollView, View } from 'react-native';

import { useAssistantThreads } from '@/data/queries';
import { a11yButton, formatFeedTime } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { IconTile } from '@/ui/kit';
import { OptionSheetHeader } from '@/ui/OptionSheet';
import { Pressable } from '@/ui/Pressable';
import { Sheet } from '@/ui/Sheet';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';

/**
 * Earlier chats (§188), the same history the web keeps: each by the question that named it and
 * the start of its answer. Picking one reopens it; "New chat" files the open one here first.
 */
export function AssistantHistorySheet({
  open,
  onClose,
  onOpen,
  onNewChat,
}: {
  open: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
  onNewChat: () => void;
}) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  const threads = useAssistantThreads();
  const rows = (threads.data ?? []).filter((row) => row.title.length > 0);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      height={u(520)}
      accessibilityLabel="Chats"
      contentStyle={styles.pad}
    >
      <OptionSheetHeader
        variant="card"
        title="Chats"
        subtitle="Pick up where you left off."
        onClose={onClose}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
        {threads.isPending ? (
          <>
            <Skeleton height={u(64)} radius="card" />
            <Skeleton height={u(64)} radius="card" />
          </>
        ) : rows.length === 0 ? (
          <Text variant="callout" color="textSecondary" align="center" style={styles.empty}>
            No earlier chats yet. Each new chat is kept here.
          </Text>
        ) : (
          rows.map((row) => (
            <Pressable
              key={row.id}
              {...a11yButton(`${row.title}${row.current ? ', open now' : ''}`)}
              accessibilityState={{ selected: row.current }}
              feedback="subtle"
              onPress={() => onOpen(row.id)}
              style={[
                styles.row,
                {
                  backgroundColor: row.current ? colors.brandSurface : colors.surfaceCard,
                  borderColor: row.current ? colors.brandBorder : colors.borderSoft,
                },
              ]}
            >
              <IconTile name="MessageChatSquare" size={36} tone={row.current ? 'card' : 'brand'} />
              <View style={styles.text}>
                <Text variant="bodyLgStrong" color="ink" numberOfLines={1}>
                  {row.title}
                </Text>
                {row.preview ? (
                  <Text variant="footnote" color="textSecondary" numberOfLines={1}>
                    {row.preview.replace(/\*\*/g, '')}
                  </Text>
                ) : null}
              </View>
              <Text variant="footnote" color="textTertiary">
                {row.current ? 'Open' : formatFeedTime(row.updatedAt)}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
      <Button
        label="New chat"
        variant="primary"
        size="xl"
        block
        leading={<Icon name="Plus" size={u(20)} color={colors.textOnDark} />}
        onPress={onNewChat}
      />
    </Sheet>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  pad: { paddingHorizontal: u(20), paddingBottom: u(12), gap: u(12) },
  scroll: { maxHeight: u(340) },
  list: { gap: u(8), paddingVertical: u(4) },
  empty: { paddingVertical: u(24) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(12),
    padding: u(12),
    borderRadius: u(18),
    borderWidth: 1,
  },
  text: { flex: 1, gap: u(2) },
}));
