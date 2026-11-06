import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { atsBandFor, figureLine, type FigureDraft, type TailorComparison } from '@/data/models';
import {
  figureKey,
  keywordGroups,
  setFigure,
  setFix,
  shownKeywords,
  tickKeyword,
  type CustomizeChoices,
  type PlanStep,
} from '@/data/models/customize';
import { useDraftFigure } from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { ChoiceChip } from '@/ui/ChoiceChip';
import { Icon } from '@/ui/Icon';
import { OptionSheetHeader } from '@/ui/OptionSheet';
import { Pressable } from '@/ui/Pressable';
import { ScoreRing } from '@/ui/Progress';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { Toggle } from '@/ui/Toggle';

import { PlanFigureEditor } from '../components/PlanFigureEditor';
import { FlowCard, FlowDivider, FlowRow, IconTile, StatusPill } from './FlowKit';

const BAND_LABEL = { strong: 'Strong match', good: 'Good match', fair: 'Fair match', weak: 'Weak match' } as const;
const BAND_TONE = { strong: 'success', good: 'success', fair: 'warning', weak: 'warning' } as const;

/** The score card at the top of Review: ring, band, where the AI's plan takes it, the source. */
export function ReviewHero({
  score,
  scored,
  projected,
  sourceTitle,
  sourceLabel = 'Tailoring from',
  onChangeSource,
  onViewJob,
}: {
  /** 0–100. */
  score: number;
  scored: boolean;
  /** Out of 10, after the plan; omitted when nothing is projected. */
  projected?: number;
  sourceTitle: string;
  sourceLabel?: string;
  onChangeSource?: () => void;
  onViewJob?: () => void;
}) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  const band = atsBandFor(score);
  const outOfTen = (Math.round(score) / 10).toFixed(1);
  return (
    <FlowCard style={styles.heroCard}>
      <View style={styles.heroRow}>
        <ScoreRing
          score={scored ? score : 0}
          valueText={scored ? outOfTen : '–'}
          size={u(76)}
          strokeWidth={u(7)}
          numberVariant="title2"
          ringColor={band === 'strong' || band === 'good' ? 'success' : 'warningAccent'}
          accessibilityLabel={scored ? `Match ${outOfTen} out of 10` : 'Not enough to score'}
        />
        <View style={styles.heroText}>
          {scored ? <StatusPill label={BAND_LABEL[band]} tone={BAND_TONE[band]} /> : null}
          <Text variant="title3" color="ink">
            {projected != null && projected > Math.round(score) / 10
              ? `AI plan takes it to ${projected.toFixed(1)}`
              : !scored
                ? 'We’ll aim it at this job'
                : band === 'strong'
                  ? 'Already a strong fit'
                  : 'The AI will lift it'}
          </Text>
          {onViewJob ? (
            <Pressable
              feedback="subtle"
              accessibilityRole="button"
              accessibilityLabel="View the job"
              onPress={onViewJob}
              style={styles.link}
            >
              <Text variant="footnote" color="brand">
                View job
              </Text>
              <Icon name="ChevronRight" size={u(14)} color={colors.brand} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <FlowDivider />
      <View style={styles.sourceRow}>
        <View style={[styles.pageTile, { backgroundColor: colors.surfaceSubtle }]}>
          <Icon name="File04" size="sm" color={colors.textSecondary} />
        </View>
        <View style={styles.flex}>
          <Text variant="footnote" color="textSecondary">
            {sourceLabel}
          </Text>
          <Text variant="bodyLgStrong" color="ink" numberOfLines={1}>
            {sourceTitle}
          </Text>
        </View>
        {onChangeSource ? (
          <Pressable
            feedback="subtle"
            accessibilityRole="button"
            accessibilityLabel="Change resume"
            onPress={onChangeSource}
            style={[styles.changePill, { backgroundColor: colors.surfaceSubtle }]}
          >
            <Text variant="footnote" color="ink">
              Change
            </Text>
          </Pressable>
        ) : null}
      </View>
    </FlowCard>
  );
}

/** The round tick at the end of an AI-plan row: solid when on, an empty ring when off. */
function PlanTick({ on }: { on: boolean }) {
  const { colors, sizes, u } = useTheme();
  return on ? (
    <IconTile name="Check" size={24} tone="solid" />
  ) : (
    <View
      style={{
        width: u(24),
        height: u(24),
        borderRadius: u(12),
        borderWidth: sizes.borderThick,
        borderColor: colors.progressTrack,
      }}
    />
  );
}

const FIX_ROWS = [
  { fixes: ['headline', 'summary'], icon: 'Edit03', title: (c: string) => `Summary aimed at ${c}`, body: 'Headline and summary for this job' },
  { fixes: ['skills'], icon: 'FilterLines', title: () => 'Skills ordered for this job', body: 'What it asks for comes first' },
  { fixes: ['experience'], icon: 'Briefcase01', title: () => 'Bullets reworded for this job', body: 'Your own facts, its words' },
] as const;

/**
 * "AI's plan": what the AI will change, each already picked (owner, 2026-11-06). A tap turns one
 * off. Steps that need a real number show the AI's guess to accept, or a field to type it.
 */
export function AiPlanCard({
  company,
  resumeId,
  steps,
  choices,
  onChange,
}: {
  company: string;
  resumeId: string;
  steps: readonly PlanStep[];
  choices: CustomizeChoices;
  onChange: (next: CustomizeChoices) => void;
}) {
  const numbers = steps.filter((s) => s.kind === 'number' && s.bullet).slice(0, 3);
  return (
    <FlowCard style={{ paddingVertical: 4 }}>
      {FIX_ROWS.map((row, index) => {
        const on = row.fixes.every((f) => choices.fixes.includes(f));
        return (
          <View key={row.title(company)}>
            {index > 0 ? <FlowDivider /> : null}
            <FlowRow
              icon={row.icon}
              title={row.title(company)}
              body={row.body}
              trailing={<PlanTick on={on} />}
              accessibilityLabel={`${row.title(company)}, ${on ? 'on' : 'off'}`}
              onPress={() =>
                onChange(row.fixes.reduce((next, fix) => setFix(next, fix, !on), choices))
              }
            />
          </View>
        );
      })}
      {numbers.map((step) => (
        <View key={step.id}>
          <FlowDivider />
          <NumberStep step={step} resumeId={resumeId} choices={choices} onChange={onChange} />
        </View>
      ))}
    </FlowCard>
  );
}

/** One "add a real result" step: the AI's guess (accept or edit), or the figure already added. */
function NumberStep({
  step,
  resumeId,
  choices,
  onChange,
}: {
  step: PlanStep;
  resumeId: string;
  choices: CustomizeChoices;
  onChange: (next: CustomizeChoices) => void;
}) {
  const { colors, sizes, u } = useTheme();
  const styles = useStyles();
  const bullet = step.bullet!;
  const saved = choices.figures?.[figureKey(bullet.roleId, bullet.index)];
  const draftFigure = useDraftFigure();
  const [draft, setDraft] = useState<FigureDraft | null>(null);
  const [editing, setEditing] = useState(false);

  const { mutate, isIdle } = draftFigure;
  useEffect(() => {
    if (saved || !isIdle) return;
    mutate(
      { resumeId, roleId: bullet.roleId, line: bullet.index, text: bullet.text },
      { onSuccess: setDraft },
    );
  }, [bullet, isIdle, mutate, resumeId, saved]);

  const save = (text: string | null) => onChange(setFigure(choices, bullet.roleId, bullet.index, text));

  return (
    <View style={styles.numberStep}>
      <FlowRow
        icon="Target"
        title="Add a result to a bullet"
        body={`“${bullet.text.length > 60 ? `${bullet.text.slice(0, 58).trim()}…` : bullet.text}”`}
        trailing={<PlanTick on={!!saved} />}
      />
      <View style={styles.numberBody}>
        {saved ? (
          <View style={styles.savedRow}>
            <Text variant="footnote" color="success" style={styles.flex} numberOfLines={2}>
              {saved}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Edit the result" onPress={() => setEditing(true)}>
              <Text variant="footnote" color="brand">
                Edit
              </Text>
            </Pressable>
          </View>
        ) : draft?.suggestion ? (
          <>
            <View style={styles.suggestRow}>
              <View
                style={[
                  styles.guess,
                  { backgroundColor: colors.brandSurface, borderColor: colors.brand, borderWidth: sizes.border },
                ]}
              >
                <Icon name="Stars02" size={u(14)} color={colors.brand} />
                <Text variant="bodyLgStrong" color="brand">
                  {draft.suggestion}
                </Text>
              </View>
              <Button
                label="Use"
                size="md"
                onPress={() => save(figureLine(draft, draft.suggestion!))}
                style={styles.smallBtn}
              />
              <Button label="Edit" variant="secondary" size="md" onPress={() => setEditing(true)} style={styles.smallBtn} />
            </View>
            <View style={styles.warnRow}>
              <Icon name="AlertCircle" size={u(14)} color={colors.warningStrong} />
              <Text variant="footnote" color="warningStrong" style={styles.flex}>
                AI guess — use it only if it’s close to true.
              </Text>
            </View>
          </>
        ) : draftFigure.isPending ? (
          <Skeleton height={u(36)} radius="full" width="60%" />
        ) : (
          <Button label="Add the real number" variant="soft" size="md" onPress={() => setEditing(true)} />
        )}
      </View>
      <Sheet open={editing} onClose={() => setEditing(false)} height={u(420)} avoidKeyboard accessibilityLabel="Add the result">
        <OptionSheetHeader title="Add the result" onClose={() => setEditing(false)} />
        <View style={styles.sheetBody}>
          {editing ? (
            <PlanFigureEditor
              resumeId={resumeId}
              bullet={bullet}
              saved={saved}
              onSave={save}
              onDone={() => setEditing(false)}
            />
          ) : null}
        </View>
      </Sheet>
    </View>
  );
}

const COLLAPSED = 10;

/** "Skills it asks for": the missing ones to tap, then the ones already shown, ticked and locked. */
export function SkillChips({
  comparison,
  choices,
  onChange,
}: {
  comparison: TailorComparison;
  choices: CustomizeChoices;
  onChange: (next: CustomizeChoices) => void;
}) {
  const styles = useStyles();
  const [all, setAll] = useState(false);
  const { missing, have } = useMemo(() => {
    const g = keywordGroups(comparison);
    return {
      missing: [...g.top, ...g.soft, ...g.more],
      have: shownKeywords(comparison).filter((k) => k.onResume),
    };
  }, [comparison]);
  const chips = [
    ...missing.map((k) => ({ label: k.label, locked: false })),
    ...have.map((k) => ({ label: k.label, locked: true })),
  ];
  const shown = all ? chips : chips.slice(0, COLLAPSED);
  return (
    <View>
      <View style={styles.chips}>
        {shown.map((chip) => (
          <ChoiceChip
            key={chip.label}
            label={chip.label}
            locked={chip.locked}
            selected={chip.locked || choices.added.includes(chip.label)}
            onPress={() =>
              onChange(
                tickKeyword(choices, chip.label, !choices.added.includes(chip.label), comparison.picks),
              )
            }
          />
        ))}
      </View>
      {chips.length > COLLAPSED ? (
        <Pressable accessibilityRole="button" onPress={() => setAll((v) => !v)} style={styles.more}>
          <Text variant="footnote" color="brand">
            {all ? 'Show fewer' : `Show ${chips.length - COLLAPSED} more`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The rare settings, out of the way: which roles, length and projects. */
export function MoreOptionsSheet({
  open,
  onClose,
  choices,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  choices: CustomizeChoices;
  onChange: (next: CustomizeChoices) => void;
}) {
  const { u } = useTheme();
  const styles = useStyles();
  return (
    <Sheet open={open} onClose={onClose} height={u(460)} accessibilityLabel="More options">
      <OptionSheetHeader title="More options" subtitle="Already set for this job." onClose={onClose} />
      <View style={styles.sheetBody}>
        <Text variant="bodyLgStrong" color="ink">
          Experience
        </Text>
        <SegmentedControl
          segments={[
            { key: 'full', label: 'Every role' },
            { key: 'quick', label: 'Latest 2 roles' },
          ]}
          value={choices.experience}
          onChange={(experience) => onChange({ ...choices, experience })}
        />
        <View style={styles.toggleRow}>
          <View style={styles.flex}>
            <Text variant="bodyLgStrong" color="ink">
              Trim the length
            </Text>
            <Text variant="footnote" color="textSecondary">
              To the pages recruiters read
            </Text>
          </View>
          <Toggle
            label="Trim the length"
            value={choices.fixes.includes('length')}
            onChange={(on) => onChange(setFix(choices, 'length', on))}
          />
        </View>
        <View style={styles.toggleRow}>
          <View style={styles.flex}>
            <Text variant="bodyLgStrong" color="ink">
              Projects
            </Text>
            <Text variant="footnote" color="textSecondary">
              Only the ones that fit
            </Text>
          </View>
          <Toggle
            label="Projects"
            value={choices.fixes.includes('projects')}
            onChange={(on) => onChange(setFix(choices, 'projects', on))}
          />
        </View>
        <Button label="Done" size="xl" block onPress={onClose} />
      </View>
    </Sheet>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  flex: { flex: 1 },
  heroCard: { gap: u(14) },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: u(16) },
  heroText: { flex: 1, gap: u(6) },
  link: { flexDirection: 'row', alignItems: 'center', gap: u(2), alignSelf: 'flex-start' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  pageTile: { width: u(32), height: u(40), borderRadius: u(6), alignItems: 'center', justifyContent: 'center' },
  changePill: { paddingHorizontal: u(14), paddingVertical: u(7), borderRadius: u(999) },
  numberStep: { paddingBottom: u(12) },
  numberBody: { paddingLeft: u(48), gap: u(8) },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: u(8), flexWrap: 'wrap' },
  guess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(6),
    paddingHorizontal: u(12),
    paddingVertical: u(8),
    borderRadius: u(12),
    borderStyle: 'dashed',
  },
  smallBtn: { height: u(38), paddingHorizontal: u(14), borderRadius: u(999) },
  warnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: u(6) },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8) },
  more: { alignSelf: 'flex-start', paddingVertical: u(10) },
  sheetBody: { paddingHorizontal: u(24), paddingTop: u(8), paddingBottom: u(24), gap: u(16) },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: u(12) },
}));
