import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';

import { ReviewPill } from '../ResumeEntryBits';

export type EntryCardProps = {
  /** "Role 1", "Project 2" — a stable handle for the delete confirm and the screen reader. */
  title: string;
  /** V2 §7.9: this entry was assumed, and the document cannot be downloaded until it is confirmed. */
  needsReview?: boolean;
  deleteLabel: string;
  confirmMessage: string;
  onDelete: () => void;
  children: ReactNode;
};

/**
 * One entry of a structured list section (V2 §7.11): a card, its delete affordance, and §7.9's
 * review pill when the product assumed the entry rather than read it.
 *
 * The delete confirms inline rather than in a sheet — the same two-step the resume card menu uses
 * for RESUMES 03's "Asks to confirm", and a sheet raised from inside a scrolling page would be a
 * second modal layer over the one the screen already owns for discarding changes.
 */
export function EntryCard({
  title,
  needsReview = false,
  deleteLabel,
  confirmMessage,
  onDelete,
  children,
}: EntryCardProps) {
  const { spacing } = useTheme();
  const [confirming, setConfirming] = useState(false);

  return (
    <Card radius="card" padding={0} style={{ padding: spacing[4], gap: spacing[4] }}>
      <View style={[styles.header, { gap: spacing[3] }]}>
        <Text variant="title" style={styles.fill} numberOfLines={1}>
          {title}
        </Text>
        {confirming ? null : (
          <IconButton
            icon="trash-alt"
            variant="ghost"
            label={deleteLabel}
            onPress={() => setConfirming(true)}
          />
        )}
      </View>

      {needsReview ? (
        <View style={{ gap: spacing[2] }}>
          <ReviewPill />
          {/* The confirm affordance is the typing itself: the repo clears the flag on the section
              it saves, so an entry the reader has edited comes back unflagged. */}
          <Text variant="caption" color="textSecondary">
            Type over it and save — that is what confirms it.
          </Text>
        </View>
      ) : null}

      {confirming ? (
        <View style={{ gap: spacing[3] }}>
          <Text variant="body" color="textSecondary">
            {confirmMessage}
          </Text>
          <View style={[styles.actions, { gap: spacing[3] }]}>
            <Button label="Delete" variant="danger" haptic="medium" onPress={onDelete} />
            <Button label="Keep" variant="ghost" onPress={() => setConfirming(false)} />
          </View>
        </View>
      ) : (
        children
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center' },
  fill: { flex: 1 },
});
