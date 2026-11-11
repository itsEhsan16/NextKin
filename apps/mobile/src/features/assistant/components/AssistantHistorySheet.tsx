import { Image } from 'expo-image';
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
import { SkeletonListRow } from '@/ui/Skeleton';
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
  const { colors, motion, u } = useTheme();
  const styles = useStyles();
  const threads = useAssistantThreads();
  const rows = (threads.data ?? []).filter((row) => row.title.length > 0);
  const empty = !threads.isPending && rows.length === 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      height={u(520)}
      fill
      accessibilityLabel="Chats"
      contentStyle={styles.pad}
    >
      <OptionSheetHeader
        variant="card"
        title="Chats"
        subtitle="Pick up where you left off."
        onClose={onClose}
      />
      {/* The list takes the room between the header and the button, so "New chat" sits at the
          foot of the sheet and an empty list centres in what is left (§208). */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.list, empty ? styles.listEmpty : null]}
        showsVerticalScrollIndicator={false}
      >
        {threads.isPending ? (
          <>
            <SkeletonListRow height={u(64)} thumb={0} trailing divider />
            <SkeletonListRow height={u(64)} thumb={0} trailing divider />
          </>
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            {/* The clay "past chats" art (§211). Decorative: the title says it. */}
            <Image
              source={require('../../../../assets/illustrations/assistant/no-chats.webp')}
              contentFit="contain"
              transition={motion.durations.imageFade}
              cachePolicy="memory-disk"
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.emptyArt}
            />
            <Text variant="title3" color="ink" align="center">
              No earlier chats yet
            </Text>
            <Text variant="callout" color="textSecondary" align="center">
              Each new chat is kept here.
            </Text>
          </View>
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
  pad: { flex: 1, paddingHorizontal: u(20), paddingTop: u(8), paddingBottom: u(20), gap: u(16) },
  scroll: { flex: 1 },
  list: { gap: u(8), paddingVertical: u(4) },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: u(8), paddingBottom: u(24) },
  // 1080 × 665 art, about 150 wide at 390.
  emptyArt: { width: u(150), height: u(150 * (665 / 1080)), marginBottom: u(4) },
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
