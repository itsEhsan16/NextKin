import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { Profile } from '@/data/models';
import { useProfile } from '@/data/queries';
import { useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { EntryRow as EntryRowView } from '@/ui/EntryRow';
import { IconButton } from '@/ui/IconButton';
import { RowGroup } from '@/ui/ListRow';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';

import type { EntryRow } from '../entryRows';
import { useProfileActions } from '../hooks/useProfileActions';

/** A row plus the optional second target the Links list gives it ("Open"). */
export type EntryListRow = EntryRow & {
  action?: { icon: string; label: string; onPress: () => void };
};

export type EntryListScreenProps = {
  title: string;
  /** Reads this list's rows off the profile — see `entryRows`. */
  select: (profile: Profile) => EntryListRow[];
  /** Sticky-bar label, e.g. "Add a role". */
  addLabel: string;
  /** Opens one entry's form; `'new'` is the same form with nothing in it. */
  onOpen: (id: string) => void;
  /**
   * No `actionLabel`: the sticky bar carries Add in every branch, so an empty state that repeated
   * it put the same words on screen twice — which is what the Certifications screen was doing.
   */
  empty: { icon: string; title: string; message: string };
  /** One quiet line under the group — the Links list uses it for the §6.2 note. */
  note?: string;
  /** Rendered as a sibling of the page, never inside its scroller (toasts, sheets). */
  overlay?: ReactNode;
};

const NEW = 'new';
const SKELETON_WIDTHS = ['62%', '48%', '55%'] as const;

/**
 * The shape all four career-profile lists share (V2 §7.3): a pushed page of grouped rows over a
 * sticky Add bar. No artboard exists for these (plan §8), so the page is assembled from the
 * built primitives — the same `RowGroup` of `ListRow`s the Profile screen itself is made of.
 *
 * Deleting deliberately lives in the entry's form, not here: a swipe that destroys a row without
 * showing what it holds is the one edit this list would not let the user check first.
 */
export function EntryListScreen({
  title,
  select,
  addLabel,
  onOpen,
  empty,
  note,
  overlay,
}: EntryListScreenProps) {
  const { colors, motion, sizes, spacing, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const actions = useProfileActions();
  const profile = useProfile();

  const page = (children: ReactNode, addDisabled = false) => (
    <View style={rootStyle.root}>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title={title} onBack={actions.goBack} />}
        headerStyle={{ paddingBottom: spacing[4] }}
        footer={
          <StickyActionBar
            primary={{
              label: addLabel,
              icon: 'plus',
              disabled: addDisabled,
              onPress: () => onOpen(NEW),
            }}
          />
        }
        contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[5] }}
      >
        {children}
      </Screen>
      {overlay}
    </View>
  );

  if (profile.isPending) {
    // The bar is pinned while loading — it owns the bottom safe-area inset, so a page without
    // one would grow a footer out of nothing the moment the query lands.
    return page(
      <Card radius="card" padding={0}>
        {SKELETON_WIDTHS.map((width, index) => (
          <View key={width} style={[styles.skeletonRow, { height: sizes.listRow }]}>
            {index > 0 ? (
              <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            ) : null}
            <Skeleton width={width} height={s(14)} />
          </View>
        ))}
      </Card>,
      true,
    );
  }

  if (profile.isError || !profile.data) {
    return page(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load your profile"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void profile.refetch()}
      />,
      true,
    );
  }

  const rows = select(profile.data);

  if (rows.length === 0) {
    return page(
      <>
        <StateView icon={empty.icon} title={empty.title} message={empty.message} />
        {note ? <Footnote text={note} /> : null}
      </>,
    );
  }

  return page(
    <>
      <RowGroup>
        {rows.map((row, index) => (
          <Animated.View
            key={row.id}
            entering={
              reduced
                ? undefined
                : FadeInDown.delay(
                    Math.min(index, motion.stagger.maxItems) * motion.stagger.row,
                  ).duration(motion.durations.base)
            }
          >
            <EntryRowItem row={row} onPress={() => onOpen(row.id)} />
          </Animated.View>
        ))}
      </RowGroup>
      {note ? <Footnote text={note} /> : null}
    </>,
  );
}

function EntryRowItem({ row, onPress }: { row: EntryListRow; onPress: () => void }) {
  const { spacing } = useTheme();
  const styles = useStyles();

  const listRow = (
    <EntryRowView
      icon={row.icon}
      title={row.title}
      meta={row.meta}
      tags={row.tags}
      showChevron={!row.action}
      accessibilityHint="Opens this entry"
      onPress={onPress}
      style={row.action ? styles.rowFlex : undefined}
    />
  );

  if (!row.action) return listRow;

  // Two targets on one row, each with its own label: the row edits the entry, the trailing
  // button opens it. Neither is reachable only by hitting the other's half of the row.
  return (
    <View style={rootStyle.rowWithAction}>
      {listRow}
      <IconButton
        icon={row.action.icon}
        label={row.action.label}
        variant="ghost"
        onPress={row.action.onPress}
        style={{ marginRight: spacing[2] }}
      />
    </View>
  );
}

function Footnote({ text }: { text: string }) {
  return (
    <Text variant="caption" color="textSecondary">
      {text}
    </Text>
  );
}

const useStyles = scaledSheet((s) => ({
  rowFlex: { flex: 1 },
  skeletonRow: { justifyContent: 'center', paddingHorizontal: s(20) },
  /** The divider inset `RowGroup` draws, so the loading rows sit on the same grid. */
  divider: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: s(56),
    height: StyleSheet.hairlineWidth,
  },
}));

const rootStyle = StyleSheet.create({
  root: { flex: 1 },
  rowWithAction: { flexDirection: 'row', alignItems: 'center' },
});
