import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { EntryTile, ProfileCard } from '@/features/profile/components/cards';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';

import { ReviewPill } from '../ResumeEntryBits';

export type EntryCardProps = {
  /** "Role 1", "Project 2" — a stable handle for the delete confirm and the screen reader. */
  title: string;
  /** "Senior UX Designer · Flipkart" under the handle (RESUMES 07 577:8637). */
  subtitle?: string;
  /** The company, school or project the letter tile is drawn from; no tile without one. */
  tileName?: string;
  /** V2 §7.9: this entry was assumed, and the document cannot be downloaded until it is confirmed. */
  needsReview?: boolean;
  deleteLabel: string;
  confirmMessage: string;
  onDelete: () => void;
  children: ReactNode;
};

// RESUMES 07 role card at 390 (577:8631), in artboard units.
const GAP = 14 / 0.75;
const HEADER_GAP = 12 / 0.75;
const TITLE_GAP = 2 / 0.75;
const DELETE = 34 / 0.75;

/**
 * One entry of a structured list section (V2 §7.11), drawn as RESUMES 07's role card: the letter
 * tile, the entry's handle and what it is, an outlined delete, then its fields. §7.9's review
 * pill sits under the header when the product assumed the entry rather than read it.
 *
 * The delete confirms inline rather than in a sheet — a sheet raised from inside a scrolling
 * page would be a second modal layer over the one the screen already owns for discarding changes.
 */
export function EntryCard({
  title,
  subtitle,
  tileName,
  needsReview = false,
  deleteLabel,
  confirmMessage,
  onDelete,
  children,
}: EntryCardProps) {
  const { colors, spacing, s } = useTheme();
  const styles = useStyles();
  const [confirming, setConfirming] = useState(false);

  return (
    <ProfileCard style={[styles.card, { padding: spacing[5] }]}>
      <View style={styles.header}>
        {tileName?.trim() ? <EntryTile tile={{ kind: 'letter', name: tileName }} /> : null}
        <View style={styles.titles}>
          <Text variant="title" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="micro" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {confirming ? null : (
          <IconButton
            icon="Trash01"
            label={deleteLabel}
            size={s(DELETE)}
            iconSize="sm"
            iconColor="textSecondary"
            onPress={() => setConfirming(true)}
            style={{ backgroundColor: colors.surfaceCard }}
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
            <Button label="Delete" variant="danger" onPress={onDelete} />
            <Button label="Keep" variant="ghost" onPress={() => setConfirming(false)} />
          </View>
        </View>
      ) : (
        children
      )}
    </ProfileCard>
  );
}

const useStyles = scaledSheet((s) => ({
  card: { gap: s(GAP) },
  header: { flexDirection: 'row', alignItems: 'center', gap: s(HEADER_GAP) },
  titles: { flex: 1, gap: s(TITLE_GAP) },
  actions: { flexDirection: 'row', alignItems: 'center' },
}));
