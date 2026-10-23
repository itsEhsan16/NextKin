import { StyleSheet, View } from 'react-native';

import { a11yHeader } from '@/lib';
import { useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { SheetRow } from '@/ui/SheetRow';
import { Text } from '@/ui/Text';

export type HomeMenuDestination =
  'history' | 'interview' | 'assistant' | 'upgrade' | 'help' | 'contact';

export type HomeMenuSheetBodyProps = {
  onSelect: (destination: HomeMenuDestination) => void;
  onClose: () => void;
};

type Row = {
  key: HomeMenuDestination;
  icon: string;
  label: string;
  description: string;
  ai?: boolean;
};

/**
 * The rows, in the order Home's own shortcut grid names them, then the account-level pages the
 * Profile tab does not carry. Every destination is a real screen — this sheet retired the last
 * placeholder, so there is nothing here that lands on "Coming soon".
 */
const ROWS: readonly Row[] = [
  {
    key: 'history',
    icon: 'history',
    label: 'History',
    description: "Everything you've generated, saved and changed",
  },
  {
    key: 'interview',
    icon: 'comments',
    label: 'Interview prep',
    description: 'Practice questions written from your resume',
    ai: true,
  },
  {
    key: 'assistant',
    icon: 'robot',
    label: 'AI assistant',
    description: 'Ask about your resume, your score or the search',
    ai: true,
  },
  {
    key: 'upgrade',
    icon: 'crown',
    label: 'NextKin Pro',
    description: 'Plans, usage and what Pro unlocks',
  },
  {
    key: 'help',
    icon: 'question-circle',
    label: 'Help & FAQ',
    description: 'Answers to the questions we get most',
  },
  {
    key: 'contact',
    icon: 'envelope',
    label: 'Contact support',
    description: 'Write to us — we reply within a day',
  },
];

/**
 * The hamburger menu's body (plan §8, phase 9I — no artboard). Reuses the create sheet's row
 * so the two sheets that open over the tab bar read as one family, and the option sheets' header
 * (`headline` title, outline ✕) so its chrome matches theirs.
 *
 * Laid out like the export sheet — gutter on both sides, the rows well apart — but at 24 between
 * rows rather than 28: six rows have to fit the fixed `sheetMenuHeight`, with room left for a
 * description that wraps.
 */
export function HomeMenuSheetBody({ onSelect, onClose }: HomeMenuSheetBodyProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ paddingHorizontal: spacing.gutter, paddingTop: spacing[6], gap: spacing[6] }}>
      <View style={styles.header}>
        <Text {...a11yHeader()} variant="headline">
          Menu
        </Text>
        <IconButton icon="times" label="Close menu" onPress={onClose} />
      </View>
      {ROWS.map((row) => (
        <SheetRow
          key={row.key}
          icon={row.icon}
          label={row.label}
          description={row.description}
          ai={row.ai}
          tone={row.ai ? 'brand' : 'neutral'}
          onPress={() => onSelect(row.key)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
