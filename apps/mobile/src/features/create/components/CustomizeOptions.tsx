import { useState } from 'react';
import { View } from 'react-native';

import type { TailorExperienceDepth, TailorFix } from '@/data/models';
import { setFix, type CustomizeChoices } from '@/data/models/customize';
import { ProfileCard } from '@/features/profile/components/cards';
import { scaledSheet } from '@/theme';
import { Disclosure } from '@/ui/Disclosure';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Text } from '@/ui/Text';
import { Toggle } from '@/ui/Toggle';

import { VsRule } from './TailorVsCard';

export type CustomizeOptionsProps = {
  choices: CustomizeChoices;
  onChange: (next: CustomizeChoices) => void;
};

/** One row per part the run can leave alone; the headline travels with the summary. */
const ROWS: readonly { fixes: readonly TailorFix[]; label: string; detail: string }[] = [
  { fixes: ['headline', 'summary'], label: 'Summary', detail: 'Headline and summary aimed at it' },
  { fixes: ['skills'], label: 'Skills', detail: 'Ordered by what this job asks for' },
  { fixes: ['experience'], label: 'Experience', detail: 'Bullets reworded for this job' },
  { fixes: ['projects'], label: 'Projects', detail: 'The ones that fit, said its way' },
  { fixes: ['length'], label: 'Length', detail: 'Trimmed to the pages recruiters read' },
];

const DEPTHS = [
  { key: 'quick', label: 'Latest 2 roles' },
  { key: 'full', label: 'Every role' },
] as const satisfies readonly { key: TailorExperienceDepth; label: string }[];

// TAILOR 02's row rhythm (607:100), in artboard units.
const ROW_PAD_X = 15 / 0.75;
const ROW_PAD_Y = 12 / 0.75;
const TEXT_GAP = 2 / 0.75;

/**
 * "Options" (toreview §114), folded away: what the run improves, all on, and how far back into the
 * work history it goes. Nobody has to open it to get a good resume.
 */
export function CustomizeOptions({ choices, onChange }: CustomizeOptionsProps) {
  const [open, setOpen] = useState(false);
  const styles = useStyles();
  const on = (fixes: readonly TailorFix[]) => fixes.every((fix) => choices.fixes.includes(fix));

  return (
    <Disclosure mode="row" title="Options" expanded={open} onToggle={() => setOpen((o) => !o)}>
      <ProfileCard>
        {ROWS.map((row, index) => (
          <View key={row.label}>
            {index > 0 ? <VsRule /> : null}
            <View style={styles.row}>
              <View style={styles.text}>
                <Text variant="menuRow">{row.label}</Text>
                <Text variant="micro" color="textSecondary">
                  {row.detail}
                </Text>
              </View>
              <Toggle
                label={`Improve ${row.label.toLowerCase()}`}
                value={on(row.fixes)}
                onChange={(value) =>
                  onChange(row.fixes.reduce((next, fix) => setFix(next, fix, value), choices))
                }
              />
            </View>
            {row.fixes.includes('experience') && on(row.fixes) ? (
              <View style={styles.depth}>
                <SegmentedControl
                  size="sm"
                  segments={DEPTHS}
                  value={choices.experience}
                  onChange={(experience) => onChange({ ...choices, experience })}
                />
              </View>
            ) : null}
          </View>
        ))}
      </ProfileCard>
    </Disclosure>
  );
}

const useStyles = scaledSheet((s) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(ROW_PAD_X),
    paddingHorizontal: s(ROW_PAD_X),
    paddingVertical: s(ROW_PAD_Y),
  },
  text: { flex: 1, gap: s(TEXT_GAP) },
  depth: { paddingHorizontal: s(ROW_PAD_X), paddingBottom: s(ROW_PAD_Y) },
}));
