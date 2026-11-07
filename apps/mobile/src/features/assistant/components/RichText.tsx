import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

/** A line that opens a list item: "- ", "• ", "* " or "1. ". */
const BULLET = /^\s*(?:[-•*]|\d+[.)])\s+/;

/** `**bold**` inside a line, as nested text. */
function Inline({ line }: { line: string }) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter((part) => part.length > 0);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <Text key={index} variant="bodyLgStrong" color="ink">
            {part.slice(2, -2)}
          </Text>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * An answer as it should read (§188): paragraphs with air between them, list lines as bullets,
 * and the `**bold**` the answers use for a number or a document's name drawn bold, never as
 * asterisks. Plain otherwise: the assistant writes prose, not documents.
 */
export function RichText({ text }: { text: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  return (
    <View style={styles.root}>
      {blocks.map((block, index) => {
        const lines = block.split('\n');
        if (lines.every((line) => BULLET.test(line))) {
          return (
            <View key={index} style={styles.list}>
              {lines.map((line, row) => (
                <View key={row} style={styles.item}>
                  <View style={[styles.dot, { backgroundColor: colors.brand }]} />
                  <Text variant="bodyLg" color="textBody" style={styles.itemText}>
                    <Inline line={line.replace(BULLET, '')} />
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={index} variant="bodyLg" color="textBody">
            <Inline line={lines.join('\n')} />
          </Text>
        );
      })}
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  root: { gap: u(10) },
  list: { gap: u(6) },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: u(10) },
  dot: { width: u(6), height: u(6), borderRadius: u(3), marginTop: u(8) },
  itemText: { flex: 1 },
}));
