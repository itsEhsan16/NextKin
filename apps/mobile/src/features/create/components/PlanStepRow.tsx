import { useState } from 'react';
import { View } from 'react-native';

import type { TailorComparison, TailorPlace } from '@/data/models';
import {
  figureKey,
  setFigure,
  setPlace,
  tickKeyword,
  togglePlace,
  type CustomizeChoices,
  type FixPlan,
  type KeywordPlace,
  type PlanStep,
} from '@/data/models/customize';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { FilterChip } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { Pill, type PillTone } from '@/ui/Pill';
import { Text } from '@/ui/Text';

import { PlanFigureEditor } from './PlanFigureEditor';

export type PlanStepRowProps = {
  step: PlanStep;
  index: number;
  comparison: TailorComparison;
  plan: FixPlan;
  choices: CustomizeChoices;
  onChange: (next: CustomizeChoices) => void;
};

// In the TAILOR 02 card's measures ("What to improve" 607:100), in artboard units.
const PAD_X = 15 / 0.75;
const PAD_Y = 12 / 0.75;
const GAP = 12 / 0.75;
const SLOT_W = 18 / 0.75;

/** Places a tick can go, then the way out of them: the same card's Skills row. */
const SKILLS_ONLY = 'Skills only (counts half)';

function whoOf(step: PlanStep): { label: string; tone: PillTone } {
  if (step.who === 'ai') return { label: 'AI does it', tone: 'brand' };
  if (step.who === 'nobody') return { label: 'Nothing to change', tone: 'neutral' };
  if (step.kind === 'evidence') return { label: 'Say where you used it', tone: 'neutral' };
  if (step.kind === 'number') return { label: 'Your real figure', tone: 'warning' };
  return { label: 'Only if you have it', tone: 'warning' };
}

const placeNote = (place: KeywordPlace | undefined): string => {
  if (!place) return 'In your Skills only: counts half';
  return place.by === 'ai'
    ? 'Counts in full · where your lines fit it, change it if you like'
    : 'Counts in full';
};

/**
 * "AI adds it to…" (toreview §163): the places picked from your lines, any others you switch on,
 * or Skills only. Several may be on at once.
 */
function PlacePicker(props: {
  keyword: string;
  places: readonly TailorPlace[];
  place: KeywordPlace | undefined;
  onToggle: (where: string, on: boolean) => void;
  onSkillsOnly: () => void;
}) {
  const { keyword, places, place, onToggle, onSkillsOnly } = props;
  const { spacing } = useTheme();
  const styles = useStyles();
  return (
    <View style={{ gap: spacing[2] }}>
      <Text variant="micro" color="textSecondary">
        {placeNote(place)}
      </Text>
      <View style={[styles.wrap, { gap: spacing[2] }]}>
        {places.map((item) => {
          const selected = place?.where.includes(item.id) ?? false;
          return (
            <FilterChip
              key={item.id}
              label={item.label}
              variant="toggle"
              selected={selected}
              accessibilityLabel={`Used ${keyword} at ${item.label}`}
              onPress={() => onToggle(item.id, !selected)}
            />
          );
        })}
        <FilterChip label={SKILLS_ONLY} variant="toggle" selected={!place} onPress={onSkillsOnly} />
      </View>
    </View>
  );
}

/**
 * One step of the plan (toreview §129): what to do, what the job's own line says, what it adds and
 * the score once it and the steps above it are done. A skill step is ticked and placed; a figure
 * step opens the line to write its real result. Every number is the engine's.
 */
export function PlanStepRow({
  step,
  index,
  comparison,
  plan,
  choices,
  onChange,
}: PlanStepRowProps) {
  const { colors, spacing } = useTheme();
  const styles = useStyles();
  const [editing, setEditing] = useState(false);

  const who = whoOf(step);
  const { keyword, bullet } = step;
  const places = comparison.places ?? [];
  const skillStep = keyword !== undefined && (step.kind === 'keyword' || step.kind === 'evidence');
  const on = keyword !== undefined && choices.added.includes(keyword);
  const place = keyword !== undefined ? choices.places[keyword] : undefined;
  const figure = bullet ? choices.figures?.[figureKey(bullet.roleId, bullet.index)] : undefined;
  const done =
    on || (step.kind === 'number' && figure !== undefined) || (step.kind === 'evidence' && !!place);

  const worth =
    step.worth !== null ? `+${step.worth.toFixed(1)}` : step.who === 'nobody' ? '—' : 'Not scored';
  const after = step.totalAfter !== undefined ? `to ${step.totalAfter.toFixed(1)}` : undefined;
  const summary = [
    step.title,
    step.importance === 'required'
      ? 'Required'
      : step.importance === 'preferred'
        ? 'Preferred'
        : '',
    who.label,
    step.worth !== null ? `Adds ${step.worth.toFixed(1)}` : worth,
    step.totalAfter !== undefined ? `Score after this step ${step.totalAfter.toFixed(1)}` : '',
    done ? 'Done' : '',
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <View style={[styles.row, { gap: spacing[3] }]}>
      <View accessible accessibilityLabel={summary} style={styles.head}>
        <View style={styles.slot}>
          {done ? (
            <Icon name="CheckCircle" size="md" color={colors.glyphSuccess} />
          ) : (
            <Text variant="captionSemiBold" color="textTertiary">
              {index + 1}
            </Text>
          )}
        </View>
        <View style={[styles.text, { gap: spacing[1] }]}>
          <Text variant="menuRow">{step.title}</Text>
          {step.need ? (
            <Text variant="micro" color="textSecondary">
              {`“${step.need}”`}
            </Text>
          ) : null}
          <Text variant="micro" color="textSecondary">
            {step.basis}
          </Text>
          <Text variant="micro" color={step.kind === 'keyword' ? 'warningStrong' : 'textBody'}>
            {step.kind === 'number' && figure ? 'Your figure is in' : step.have}
          </Text>
          <View style={[styles.wrap, { gap: spacing[2] }]}>
            {step.importance === 'required' ? <Pill label="Required" tone="warning" /> : null}
            {step.importance === 'preferred' ? <Pill label="Preferred" /> : null}
            <Pill label={who.label} tone={who.tone} />
          </View>
        </View>
        <View style={styles.worth}>
          <Text
            variant={step.worth !== null ? 'captionSemiBold' : 'micro'}
            color={step.worth !== null ? 'success' : 'textTertiary'}
          >
            {worth}
          </Text>
          {after ? (
            <Text variant="micro" color="textTertiary">
              {after}
            </Text>
          ) : null}
        </View>
      </View>

      {skillStep ? (
        <View style={[styles.actions, { gap: spacing[3] }]}>
          <FilterChip
            label={step.kind === 'keyword' ? 'I have this' : 'Show it in a role'}
            variant="toggle"
            selected={on}
            accessibilityLabel={`${step.kind === 'keyword' ? 'I have' : 'Show in a role:'} ${keyword}`}
            onPress={() => onChange(tickKeyword(choices, keyword, !on, comparison.picks))}
            style={styles.start}
          />
          {on && places.length > 0 ? (
            <PlacePicker
              keyword={keyword}
              places={places}
              place={place}
              onToggle={(where, next) => onChange(togglePlace(choices, keyword, where, next))}
              onSkillsOnly={() => onChange(setPlace(choices, keyword, null))}
            />
          ) : null}
        </View>
      ) : null}

      {step.kind === 'number' && bullet ? (
        <View style={[styles.actions, { gap: spacing[3] }]}>
          <Button
            label={figure ? 'Edit your figure' : 'Add the result'}
            variant="ghost"
            onPress={() => setEditing((open) => !open)}
            style={styles.start}
          />
          {editing ? (
            <PlanFigureEditor
              resumeId={comparison.resumeId}
              bullet={bullet}
              saved={figure}
              onSave={(text) => onChange(setFigure(choices, bullet.roleId, bullet.index, text))}
              onDone={() => setEditing(false)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { paddingHorizontal: s(PAD_X), paddingVertical: s(PAD_Y) },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: s(GAP) },
  slot: { width: s(SLOT_W), alignItems: 'center' },
  text: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  worth: { alignItems: 'flex-end' },
  actions: { marginLeft: s(SLOT_W + GAP) },
  start: { alignSelf: 'flex-start' },
}));
