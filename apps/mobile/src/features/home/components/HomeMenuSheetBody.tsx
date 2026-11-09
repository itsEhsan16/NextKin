import { Fragment } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { FlowCard, FlowDivider, FlowRow } from '@/ui/kit/FlowKit';
import { Text } from '@/ui/Text';
import type { LineIconName } from '@/ui/Icon';

export type HomeMenuDestination =
  'history' | 'interview' | 'assistant' | 'upgrade' | 'help' | 'contact';

export type HomeMenuSheetBodyProps = {
  onSelect: (destination: HomeMenuDestination) => void;
  onClose: () => void;
};

type Row = {
  key: HomeMenuDestination;
  icon: LineIconName;
  label: string;
  description: string;
  /** Spoken as "…, AI powered", like the create sheet's AI rows. */
  ai?: boolean;
};

type Group = { title: string; rows: readonly Row[] };

/**
 * The menu in three groups (owner, 2026-11-09, §207): the AI tools first, then the user's own
 * work and plan, then help. Each group is one card of rows, the pattern Settings and the
 * redesigned flows use, and every description is one short line so the rows sit evenly. The
 * group heading says "AI tools", so the rows no longer each carry a "+ AI" badge.
 */
const GROUPS: readonly Group[] = [
  {
    title: 'AI tools',
    rows: [
      {
        key: 'assistant',
        icon: 'Stars02',
        label: 'AI assistant',
        description: 'Ask about your resume, score or search',
        ai: true,
      },
      {
        key: 'interview',
        icon: 'MessageChatSquare',
        label: 'Interview prep',
        description: 'Practice questions from your resume',
        ai: true,
      },
    ],
  },
  {
    title: 'Your work',
    rows: [
      {
        key: 'history',
        icon: 'ClockRewind',
        label: 'History',
        description: 'Everything you’ve made and changed',
      },
      {
        key: 'upgrade',
        icon: 'Star01',
        label: 'NextKin Pro',
        description: 'Plans, usage and what Pro unlocks',
      },
    ],
  },
  {
    title: 'Help',
    rows: [
      {
        key: 'help',
        icon: 'HelpCircle',
        label: 'Help & FAQ',
        description: 'Answers to common questions',
      },
      {
        key: 'contact',
        icon: 'Mail01',
        label: 'Contact support',
        description: 'Write to us, we reply within a day',
      },
    ],
  },
];

/**
 * The hamburger menu's body (plan §8, phase 9I — no artboard). The header keeps the option
 * sheets' chrome (title, outline ✕); the groups scroll if a large font setting needs more room
 * than the sheet's fixed height.
 */
export function HomeMenuSheetBody({ onSelect, onClose }: HomeMenuSheetBodyProps) {
  const { spacing } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.root, { paddingTop: spacing[6] }]}>
      <View style={[styles.header, { paddingHorizontal: spacing.gutter }]}>
        <Text {...a11yHeader()} variant="headline">
          Menu
        </Text>
        <IconButton icon="XClose" label="Close menu" onPress={onClose} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.groups, { paddingHorizontal: spacing.gutter }]}
      >
        {GROUPS.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text variant="eyebrow" color="textTertiary" {...a11yHeader(group.title)}>
              {group.title.toUpperCase()}
            </Text>
            <FlowCard style={styles.card}>
              {group.rows.map((row, index) => (
                <Fragment key={row.key}>
                  {index > 0 ? <FlowDivider /> : null}
                  <FlowRow
                    icon={row.icon}
                    title={row.label}
                    body={row.description}
                    accessibilityLabel={row.ai ? `${row.label}, AI powered` : row.label}
                    onPress={() => onSelect(row.key)}
                  />
                </Fragment>
              ))}
            </FlowCard>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles0 = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

const useStyles = scaledSheet((_s, u) => ({
  root: { flex: 1, gap: u(16) },
  header: styles0.header,
  groups: { gap: u(18), paddingBottom: u(24) },
  group: { gap: u(8) },
  card: { paddingVertical: u(2) },
}));
