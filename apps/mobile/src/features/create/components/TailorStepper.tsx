import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { Fragment } from 'react';
import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type TailorStep = 'compare' | 'fix' | 'download';
export type CoverStep = 'setup' | 'write' | 'download';
export type ZeroStep = 'about' | 'draft' | 'check';

export type FlowStepDef<K extends string> = { key: K; label: string };

/** Tailor (toreview §56). */
export const TAILOR_STEPS: readonly FlowStepDef<TailorStep>[] = [
  { key: 'compare', label: 'Compare' },
  { key: 'fix', label: 'Fix' },
  { key: 'download', label: 'Download' },
];

/** Cover letter (COVER 01–03, toreview §71). */
export const COVER_STEPS: readonly FlowStepDef<CoverStep>[] = [
  { key: 'setup', label: 'Set up' },
  { key: 'write', label: 'Write' },
  { key: 'download', label: 'Download' },
];

/** Zero Resume (ZERO 01–05, toreview §72). */
export const ZERO_STEPS: readonly FlowStepDef<ZeroStep>[] = [
  { key: 'about', label: 'About you' },
  { key: 'draft', label: 'Draft' },
  { key: 'check', label: 'Check' },
];

// The stepper at 390 (TAILOR 02 607:9), in artboard units.
const GAP = 8 / 0.75;
const STEP_GAP = 6 / 0.75;
const DOT = 20 / 0.75;
const CHECK = 9 / 0.75;
const CONNECTOR_W = 22 / 0.75;
const CONNECTOR_H = 1.5 / 0.75;

/**
 * Compare · Fix · Download across the job-first tailor flow (TAILOR 02–06, toreview §56). The
 * current step is a brand disc with its number, a finished one a brand disc with a tick, and the
 * connector after a finished step turns brand too. Read as one line: "Step 2 of 3, Fix".
 */
export function TailorStepper({ current }: { current: TailorStep }) {
  return <FlowStepper steps={TAILOR_STEPS} current={current} />;
}

/**
 * The same three-step line for any flow: the cover letter's Set up · Write · Download. `allDone`
 * ticks every step, the last included — ZERO 05 draws all three checked once the checks are done.
 */
export function FlowStepper<K extends string>({
  steps,
  current,
  allDone = false,
}: {
  steps: readonly FlowStepDef<K>[];
  current: K;
  allDone?: boolean;
}) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();
  const STEPS = steps;
  const at = allDone ? STEPS.length : STEPS.findIndex((step) => step.key === current);
  const label = allDone ? 'All done' : (STEPS[at]?.label ?? '');

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={
        allDone ? `All ${STEPS.length} steps done` : `Step ${at + 1} of ${STEPS.length}, ${label}`
      }
      style={styles.row}
    >
      {STEPS.map((step, index) => {
        const done = index < at;
        const active = index === at;
        const lit = done || active;
        return (
          <Fragment key={step.key}>
            {index > 0 ? (
              <View
                style={[
                  styles.connector,
                  { backgroundColor: index <= at ? colors.brand : colors.borderDefault },
                ]}
              />
            ) : null}
            <View style={styles.step}>
              <View
                style={[
                  styles.dot,
                  {
                    borderRadius: radii.full,
                    backgroundColor: lit ? colors.brand : colors.surfaceSubtle,
                  },
                ]}
              >
                {done ? (
                  <FontAwesome5 name="check" size={s(CHECK)} color={colors.textOnBrand} solid />
                ) : (
                  <Text variant="microBadge" color={active ? 'textOnBrand' : 'textSecondary'}>
                    {String(index + 1)}
                  </Text>
                )}
              </View>
              <Text
                variant={lit ? 'microBadge' : 'micro'}
                color={lit ? 'textPrimary' : 'textTertiary'}
              >
                {step.label}
              </Text>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(GAP) },
  step: { flexDirection: 'row', alignItems: 'center', gap: s(STEP_GAP) },
  dot: { width: s(DOT), height: s(DOT), alignItems: 'center', justifyContent: 'center' },
  connector: { width: s(CONNECTOR_W), height: s(CONNECTOR_H), borderRadius: s(1) },
}));
