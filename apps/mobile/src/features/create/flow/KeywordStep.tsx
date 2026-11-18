import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { atsBandFor, type TailorComparison } from '@/data/models';
import { tickKeyword, type CustomizeChoices } from '@/data/models/customize';
import { keywordRowsOf, type KeywordRow } from '@/data/models/keywordRows';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { ScoreRing } from '@/ui/Progress';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Text } from '@/ui/Text';

import { FlowCard, FlowDivider, IconTile, StatusPill } from './FlowKit';

/**
 * TAILOR "2 of 3 · Choose Keywords" (owner's mockup, 2026-11-18): the web's "Choose keywords to
 * add" step (`apps/web/src/features/tailor/flow/EnhanceStep.tsx`) in the app's own kit. Every
 * number is read off the comparison and the shared plan maths (`projectedScore`); nothing is
 * invented here. Owner trims carried over from the web (§214): no kind filters, no take-all card.
 */

export const BAND_LABEL = {
  strong: 'Strong match',
  good: 'Good match',
  fair: 'Fair match',
  weak: 'Weak match',
} as const;
const BAND_TONE = { strong: 'success', good: 'success', fair: 'warning', weak: 'warning' } as const;

const outOf10 = (n: number) => n.toFixed(1);
const points = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;

/** "Job & resume": the job, and the resume the run starts from. A tap changes the resume. */
export function JobResumeRow({
  job,
  resumeTitle,
  onPress,
  label = 'Change the resume',
}: {
  job: string;
  resumeTitle: string;
  onPress?: () => void;
  /** What a tap does, for a screen reader. */
  label?: string;
}) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  const body = (
    <>
      <IconTile name="File04" size={44} tone="brand" />
      <View style={styles.flex}>
        <Text variant="footnote" color="textSecondary">
          Job & resume
        </Text>
        <Text variant="bodyLgStrong" color="ink" numberOfLines={2}>
          {job}
        </Text>
        <Text variant="footnote" color="textSecondary" numberOfLines={1}>
          {`Using ${resumeTitle}`}
        </Text>
      </View>
      {onPress ? <Icon name="ChevronRight" size={u(20)} color={colors.textSecondary} /> : null}
    </>
  );
  return (
    <FlowCard style={styles.jobCard}>
      {onPress ? (
        <Pressable
          feedback="subtle"
          accessibilityRole="button"
          accessibilityLabel={`${job}. Using ${resumeTitle}. ${label}`}
          onPress={onPress}
          style={styles.row}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.row}>{body}</View>
      )}
    </FlowCard>
  );
}

/** The ATS card: today's score, its band, and what the ticked keywords add (the web's AtsMatchCard). */
export function AtsEstimateCard({
  score,
  scored,
  gain,
  ticked,
  emptyLine = 'Tick the keywords you have to see what they add.',
}: {
  /** 0–100. */
  score: number;
  scored: boolean;
  /** The line when nothing ticked adds a measured gain. */
  emptyLine?: string;
  /** Points out of 10 the candidate's own answers add. */
  gain: number;
  ticked: number;
}) {
  const { u } = useTheme();
  const styles = useStyles();
  const band = atsBandFor(score);
  const now = outOf10(Math.round(score) / 10);
  return (
    <FlowCard style={styles.atsCard}>
      <ScoreRing
        score={scored ? score : 0}
        valueText={scored ? now : '–'}
        size={u(96)}
        strokeWidth={u(8)}
        numberVariant="title1"
        ringColor={band === 'strong' || band === 'good' ? 'success' : 'warningAccent'}
        accessibilityLabel={scored ? `ATS score ${now} out of 10` : 'Not enough to score'}
      />
      <View style={[styles.flex, styles.atsText]}>
        {scored ? <StatusPill label={BAND_LABEL[band]} tone={BAND_TONE[band]} /> : null}
        {gain > 0 ? (
          <>
            <Text variant="title3" color="success" accessibilityLiveRegion="polite">
              {`${points(gain)} points (est.)`}
            </Text>
            <Text variant="footnote" color="textSecondary">
              {ticked > 0
                ? `If you add ${ticked} selected keyword${ticked === 1 ? '' : 's'}`
                : 'With your answers so far'}
            </Text>
          </>
        ) : (
          <Text variant="callout" color="textSecondary">
            {emptyLine}
          </Text>
        )}
      </View>
    </FlowCard>
  );
}

export type KeywordTabKey = 'missing' | 'optional' | 'all';

/** One row of the list: a missing keyword to tick, or (on All) one the resume already shows. */
type ListRow = { row: KeywordRow; onResume: false } | { label: string; onResume: true };
const labelOf = (r: ListRow) => (r.onResume ? r.label : r.row.label);

/** How many rows show before "Show N more keywords". */
export const KEYWORDS_SHOWN = 5;

/**
 * Missing / Optional / All, then the list. Missing is what the job requires and the resume lacks;
 * Optional is what it prefers (and soft skills); All adds the ones the resume already shows,
 * ticked and locked. The tab counts are the rows each tab holds. Tailor and Build both draw it:
 * each says what is ticked and what a tick does.
 */
export function KeywordChooser({
  rows,
  have,
  ticked,
  onTick,
  haveLabel = 'On your resume',
}: {
  /** The keywords to choose from (`keywordRowsOf`). */
  rows: readonly KeywordRow[];
  /** The ones already shown, listed on All only. */
  have: readonly string[];
  ticked: readonly string[];
  /** One tick, or "Select all" / "Clear all" for a tab. */
  onTick: (labels: readonly string[], on: boolean) => void;
  haveLabel?: string;
}) {
  const styles = useStyles();
  // Opens on the first tab with something to tick, so an empty Missing never greets anyone.
  const [tab, setTab] = useState<KeywordTabKey>(() =>
    rows.some((r) => r.tab === 'missing')
      ? 'missing'
      : rows.some((r) => r.tab === 'optional')
        ? 'optional'
        : 'all',
  );
  const [expanded, setExpanded] = useState(false);
  const lists: Record<KeywordTabKey, ListRow[]> = useMemo(
    () => ({
      missing: rows.filter((r) => r.tab === 'missing').map((row) => ({ row, onResume: false })),
      optional: rows.filter((r) => r.tab === 'optional').map((row) => ({ row, onResume: false })),
      all: [
        ...rows.map((row): ListRow => ({ row, onResume: false })),
        ...have.map((label): ListRow => ({ label, onResume: true })),
      ],
    }),
    [rows, have],
  );
  const max = Math.max(0, ...rows.map((r) => r.worth ?? 0));
  const list = lists[tab];
  const shown = expanded ? list : list.slice(0, KEYWORDS_SHOWN);
  const open = list.filter((r): r is Extract<ListRow, { onResume: false }> => !r.onResume);
  const allTicked = open.length > 0 && open.every((r) => ticked.includes(r.row.label));
  const toggleAll = () =>
    onTick(
      open.map((r) => r.row.label),
      !allTicked,
    );

  return (
    <View style={styles.chooser}>
      <SegmentedControl
        segments={[
          { key: 'missing', label: `Missing (${lists.missing.length})` },
          { key: 'optional', label: `Optional (${lists.optional.length})` },
          { key: 'all', label: `All (${lists.all.length})` },
        ]}
        value={tab}
        onChange={(next) => {
          setTab(next);
          setExpanded(false);
        }}
      />
      {list.length === 0 ? (
        <FlowCard>
          <Text variant="callout" color="textSecondary" align="center">
            {tab === 'optional'
              ? 'Nothing optional is missing.'
              : 'You already show every keyword this job requires.'}
          </Text>
        </FlowCard>
      ) : (
        <FlowCard style={styles.listCard}>
          {open.length > 0 ? (
            <View style={styles.listHead}>
              <Text variant="footnote" color="textSecondary">
                {`${open.length} to choose from`}
              </Text>
              <Pressable
                feedback="subtle"
                accessibilityRole="button"
                onPress={toggleAll}
                style={styles.headLink}
              >
                <Text variant="footnote" color="brand">
                  {allTicked ? 'Clear all' : 'Select all'}
                </Text>
              </Pressable>
            </View>
          ) : null}
          {shown.map((item, index) => (
            <View key={labelOf(item)}>
              {index > 0 || open.length > 0 ? <FlowDivider /> : null}
              {item.onResume ? (
                <KeywordLine label={item.label} checked locked lockedLabel={haveLabel} tag={null} />
              ) : (
                <KeywordLine
                  label={item.row.label}
                  tag={item.row.tag}
                  worth={item.row.worth}
                  strong={max > 0 && (item.row.worth ?? 0) >= max * 0.6}
                  yours={item.row.elsewhere !== undefined}
                  checked={ticked.includes(item.row.label)}
                  onToggle={(on) => onTick([item.row.label], on)}
                />
              )}
            </View>
          ))}
          {list.length > KEYWORDS_SHOWN ? (
            <Pressable
              feedback="subtle"
              accessibilityRole="button"
              onPress={() => setExpanded((v) => !v)}
              style={styles.more}
            >
              <Text variant="bodySemiBold" color="brand">
                {expanded
                  ? 'Show fewer keywords'
                  : `Show ${list.length - KEYWORDS_SHOWN} more keywords`}
              </Text>
              <MoreChevron up={expanded} />
            </Pressable>
          ) : null}
        </FlowCard>
      )}
    </View>
  );
}

/** Tailor's ticks: a tick takes the places the comparison picked for it (`tickKeyword`). */
export function tailorTicks(
  comparison: TailorComparison,
  choices: CustomizeChoices,
  onChange: (next: CustomizeChoices) => void,
) {
  return {
    rows: keywordRowsOf(comparison),
    have: comparison.keywords.filter((k) => k.onResume).map((k) => k.label),
    ticked: choices.added,
    onTick: (labels: readonly string[], on: boolean) =>
      onChange(
        labels.reduce(
          (next, label) => tickKeyword(next, label, on, comparison.picks, comparison.backed),
          choices,
        ),
      ),
  };
}

function MoreChevron({ up }: { up: boolean }) {
  const { colors, u } = useTheme();
  return <Icon name={up ? 'ChevronUp' : 'ChevronDown'} size={u(18)} color={colors.brand} />;
}

/** The square tick of a keyword row: brand-filled when on, an outline when off. */
function Checkbox({ checked, locked }: { checked: boolean; locked?: boolean }) {
  const { colors, sizes, u } = useTheme();
  return (
    <View
      style={{
        width: u(26),
        height: u(26),
        borderRadius: u(7),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: checked ? (locked ? colors.brandSurface : colors.brand) : 'transparent',
        borderWidth: checked ? 0 : sizes.borderThick,
        borderColor: colors.progressTrack,
      }}
    >
      {checked ? (
        <Icon name="Check" size={u(16)} color={locked ? colors.brand : colors.textOnDark} />
      ) : null}
    </View>
  );
}

function KeywordLine({
  label,
  tag,
  worth = null,
  strong = false,
  yours = false,
  checked,
  locked = false,
  lockedLabel = 'On your resume',
  onToggle,
}: {
  label: string;
  tag: string | null;
  worth?: number | null;
  strong?: boolean;
  yours?: boolean;
  checked: boolean;
  locked?: boolean;
  lockedLabel?: string;
  onToggle?: (on: boolean) => void;
}) {
  const styles = useStyles();
  const content = (
    <>
      <Checkbox checked={checked} locked={locked} />
      <View style={[styles.flex, styles.lineText]}>
        <Text variant="bodyLgStrong" color="ink">
          {label}
        </Text>
        <View style={styles.tags}>
          {locked ? (
            <StatusPill label={lockedLabel} tone="neutral" />
          ) : (
            <>
              {tag ? <StatusPill label={tag} tone="brand" /> : null}
              {yours ? <StatusPill label="In your profile" tone="success" /> : null}
            </>
          )}
        </View>
      </View>
      {worth !== null && worth > 0 ? (
        <View style={styles.impact}>
          <Text variant="bodyLgStrong" color={strong ? 'success' : 'ink'}>
            {points(worth)}
          </Text>
          <Text variant="footnote" color="textTertiary">
            Impact
          </Text>
        </View>
      ) : null}
    </>
  );
  if (locked || !onToggle) {
    return (
      <View
        style={styles.line}
        accessible
        accessibilityRole="checkbox"
        accessibilityState={{ checked: true, disabled: true }}
        accessibilityLabel={label}
        accessibilityHint={`Already there: ${lockedLabel.toLowerCase()}`}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      feedback="subtle"
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      accessibilityHint={worth ? `Adds about ${worth.toFixed(1)} points` : undefined}
      onPress={() => onToggle(!checked)}
      style={styles.line}
    >
      {content}
    </Pressable>
  );
}

/** The green line under the list: where the choices land (the web's projection banner). */
export function ProjectionBar({
  projected,
  base,
}: {
  /** Out of 10. */
  projected: number;
  base: number;
}) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  const gain = Math.round((projected - base) * 10) / 10;
  if (gain <= 0) return null;
  const band = atsBandFor(projected * 10);
  return (
    <View
      style={[styles.projection, { backgroundColor: colors.successSurface }]}
      accessibilityLiveRegion="polite"
    >
      <Icon name="ArrowUp" size={u(22)} color={colors.success} />
      <View style={styles.flex}>
        <Text variant="bodyLgStrong" color="success">
          {`About ${outOf10(projected)}/10 after this · ${points(gain)} points`}
        </Text>
        <Text variant="footnote" color="success">
          {`Up from ${outOf10(base)}. That reads as a ${BAND_LABEL[band].toLowerCase()}.`}
        </Text>
      </View>
    </View>
  );
}

/** The pinned footer: how many are ticked, of how many, and the one button on. */
export function KeywordFooter({
  ticked,
  total,
  label,
  note,
  noteTone = 'neutral',
  loading,
  disabled,
  onPress,
}: {
  ticked: number;
  total: number;
  label: string;
  note?: string;
  noteTone?: 'neutral' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.footer}>
      <View style={styles.footerRow}>
        <View style={styles.count}>
          <Text variant="bodyLgStrong" color="ink">
            {`${ticked} keyword${ticked === 1 ? '' : 's'} selected`}
          </Text>
          <Text variant="footnote" color="textSecondary">
            {`From ${total} total`}
          </Text>
        </View>
        <Button
          label={label}
          size="xl"
          block
          loading={loading}
          disabled={disabled}
          leading={<Icon name="ArrowRight" size={u(20)} color={colors.textOnDark} />}
          onPress={onPress}
          style={styles.flex}
        />
      </View>
      {note ? (
        <Text
          variant="footnote"
          color={noteTone === 'danger' ? 'danger' : 'textTertiary'}
          align="center"
          accessibilityLiveRegion="polite"
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  flex: { flex: 1 },
  jobCard: { paddingVertical: u(14) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(14) },
  atsCard: { flexDirection: 'row', alignItems: 'center', gap: u(18) },
  atsText: { gap: u(6) },
  chooser: { gap: u(14) },
  listCard: { paddingVertical: u(4) },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: u(10),
  },
  headLink: { paddingVertical: u(4), paddingLeft: u(12) },
  line: { flexDirection: 'row', alignItems: 'center', gap: u(14), paddingVertical: u(12) },
  lineText: { gap: u(6) },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6) },
  impact: { alignItems: 'flex-end' },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: u(6),
    paddingVertical: u(14),
  },
  projection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: u(12),
    paddingHorizontal: u(16),
    paddingVertical: u(14),
    borderRadius: u(18),
  },
  footer: { gap: u(8) },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: u(14) },
  count: { maxWidth: '42%' },
}));
