import { View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import type { ContentEducation } from '@/data/models';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';

import { newEducation, removeAt, replaceAt } from '../../sectionEdits';
import { EntryCard } from './EntryCard';
import type { SectionFieldsProps } from './types';

/** V2 §7.11 — one card per education entry; §7.9 flags the ones Zero Resume Mode assumed. */
export function EducationEditor({
  value,
  onChange,
  errors,
  onBlurField,
}: SectionFieldsProps<ContentEducation[]>) {
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();
  const layout = reduced ? undefined : LinearTransition.springify();

  const patch = (index: number, next: ContentEducation) => onChange(replaceAt(value, index, next));

  return (
    <View style={{ gap: spacing[4] }}>
      {value.map((entry, index) => {
        const name = `Entry ${index + 1}`;
        return (
          <Animated.View
            key={entry.id}
            layout={layout}
            entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}
          >
            <EntryCard
              title={name}
              needsReview={entry.needsReview}
              deleteLabel={`Delete ${name}`}
              confirmMessage={`Delete ${entry.institution.trim() || name.toLowerCase()}? This cannot be undone from here.`}
              onDelete={() => onChange(removeAt(value, index))}
            >
              <TextField
                label="Institution"
                accessibilityLabel={`${name}, institution`}
                placeholder="National Institute of Design"
                value={entry.institution}
                onChangeText={(text) => patch(index, { ...entry, institution: text })}
                onBlur={() => onBlurField?.(`${entry.id}.institution`)}
                error={errors[`${entry.id}.institution`]}
              />
              <TextField
                label="Qualification"
                accessibilityLabel={`${name}, qualification`}
                placeholder="M.Des, Interaction Design"
                value={entry.degree}
                onChangeText={(text) => patch(index, { ...entry, degree: text })}
                onBlur={() => onBlurField?.(`${entry.id}.degree`)}
                error={errors[`${entry.id}.degree`]}
              />
              <TextField
                label="Dates"
                accessibilityLabel={`${name}, dates`}
                placeholder="2014 — 2016"
                helper="Write it the way it should print."
                value={entry.period}
                onChangeText={(text) => patch(index, { ...entry, period: text })}
                onBlur={() => onBlurField?.(`${entry.id}.period`)}
                error={errors[`${entry.id}.period`]}
              />
            </EntryCard>
          </Animated.View>
        );
      })}

      <Button
        label="Add education"
        variant="secondary"
        icon="plus"
        block
        onPress={() => onChange([...value, newEducation()])}
      />
    </View>
  );
}
