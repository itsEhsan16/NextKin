import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { ContentEducation } from '@/data/models';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { TextField } from '@/ui/TextField';
import { layoutTransition } from '@/ui/motion';

import { newEducation, removeAt, replaceAt } from '../../sectionEdits';
import { AddSectionTile } from '../AddSectionTile';
import { EntryCard } from './EntryCard';
import { ADD_ENTRY_STYLE, CARD_STACK_GAP, FIELD_GAP } from './entryLayout';
import type { SectionFieldsProps } from './types';

/** V2 §7.11 — one card per education entry; §7.9 flags the ones Zero Resume Mode assumed. */
export function EducationEditor({
  value,
  onChange,
  errors,
  onBlurField,
}: SectionFieldsProps<ContentEducation[]>) {
  const { motion, s } = useTheme();
  const reduced = useReducedMotion();
  const layout = layoutTransition(reduced);

  const patch = (index: number, next: ContentEducation) => onChange(replaceAt(value, index, next));

  return (
    <View style={{ gap: s(CARD_STACK_GAP) }}>
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
              subtitle={[entry.degree, entry.institution].filter((part) => part.trim()).join(' · ')}
              tileName={entry.institution}
              needsReview={entry.needsReview}
              deleteLabel={`Delete ${name}`}
              confirmMessage={`Delete ${entry.institution.trim() || name.toLowerCase()}? This cannot be undone from here.`}
              onDelete={() => onChange(removeAt(value, index))}
            >
              <View style={{ gap: s(FIELD_GAP) }}>
                <TextField
                  label="Institution"
                  icon="university"
                  accessibilityLabel={`${name}, institution`}
                  placeholder="National Institute of Design"
                  value={entry.institution}
                  onChangeText={(text) => patch(index, { ...entry, institution: text })}
                  onBlur={() => onBlurField?.(`${entry.id}.institution`)}
                  error={errors[`${entry.id}.institution`]}
                />
                <TextField
                  label="Qualification"
                  icon="graduation-cap"
                  accessibilityLabel={`${name}, qualification`}
                  placeholder="M.Des, Interaction Design"
                  value={entry.degree}
                  onChangeText={(text) => patch(index, { ...entry, degree: text })}
                  onBlur={() => onBlurField?.(`${entry.id}.degree`)}
                  error={errors[`${entry.id}.degree`]}
                />
                <TextField
                  label="Dates"
                  icon="calendar-alt"
                  accessibilityLabel={`${name}, dates`}
                  placeholder="2014 — 2016"
                  value={entry.period}
                  onChangeText={(text) => patch(index, { ...entry, period: text })}
                  onBlur={() => onBlurField?.(`${entry.id}.period`)}
                  error={errors[`${entry.id}.period`]}
                />
              </View>
            </EntryCard>
          </Animated.View>
        );
      })}

      <AddSectionTile
        label="Education"
        onPress={() => onChange([...value, newEducation()])}
        style={{ minHeight: s(ADD_ENTRY_STYLE.height), paddingHorizontal: s(ADD_ENTRY_STYLE.padX) }}
      />
    </View>
  );
}
