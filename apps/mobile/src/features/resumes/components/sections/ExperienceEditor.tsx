import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { ContentRole } from '@/data/models';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { TextField, useFieldChain } from '@/ui/TextField';
import { layoutTransition } from '@/ui/motion';

import { newRole, removeAt, replaceAt } from '../../sectionEdits';
import { AddSectionTile } from '../AddSectionTile';
import { BulletRows } from './BulletRows';
import { EntryCard } from './EntryCard';
import { ADD_ENTRY_STYLE, CARD_STACK_GAP, FIELD_GAP } from './entryLayout';
import type { SectionFieldsProps } from './types';

/**
 * V2 §7.11 — the experience section: one card per role, each with its dated header fields and its
 * bullets. §7.9's assumed roles wear the review pill here, and typing over one is what confirms
 * it: the repo clears the flag on every entry in the section it saves.
 */
export function ExperienceEditor({
  value,
  onChange,
  errors,
  onBlurField,
}: SectionFieldsProps<ContentRole[]>) {
  const { motion, s } = useTheme();
  const link = useFieldChain(value.length * 3);
  const reduced = useReducedMotion();
  const layout = layoutTransition(reduced);

  const patch = (index: number, next: ContentRole) => onChange(replaceAt(value, index, next));

  return (
    <View style={{ gap: s(CARD_STACK_GAP) }}>
      {value.map((role, index) => {
        const name = `Role ${index + 1}`;
        return (
          <Animated.View
            key={role.id}
            layout={layout}
            entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}
          >
            <EntryCard
              title={name}
              subtitle={[role.title, role.company].filter((part) => part.trim()).join(' · ')}
              tileName={role.company}
              needsReview={role.needsReview}
              deleteLabel={`Delete ${name}`}
              confirmMessage={`Delete ${role.title.trim() || name.toLowerCase()}? This cannot be undone from here.`}
              onDelete={() => onChange(removeAt(value, index))}
            >
              <View style={{ gap: s(FIELD_GAP) }}>
                <TextField
                  {...link(index * 3)}
                  label="Job title"
                  icon="Briefcase01"
                  accessibilityLabel={`${name}, job title`}
                  placeholder="Senior Product Designer"
                  value={role.title}
                  onChangeText={(text) => patch(index, { ...role, title: text })}
                  onBlur={() => onBlurField?.(`${role.id}.title`)}
                  error={errors[`${role.id}.title`]}
                />
                <TextField
                  {...link(index * 3 + 1)}
                  label="Company"
                  icon="Building02"
                  accessibilityLabel={`${name}, company`}
                  placeholder="PhonePe"
                  value={role.company}
                  onChangeText={(text) => patch(index, { ...role, company: text })}
                  onBlur={() => onBlurField?.(`${role.id}.company`)}
                  error={errors[`${role.id}.company`]}
                />
                <TextField
                  {...link(index * 3 + 2)}
                  label="Dates"
                  icon="Calendar"
                  accessibilityLabel={`${name}, dates`}
                  placeholder="Mar 2022 — Present"
                  value={role.period}
                  onChangeText={(text) => patch(index, { ...role, period: text })}
                  onBlur={() => onBlurField?.(`${role.id}.period`)}
                  error={errors[`${role.id}.period`]}
                />
              </View>
              <BulletRows
                entryId={role.id}
                entryName={name}
                bullets={role.bullets}
                onChange={(bullets) => patch(index, { ...role, bullets })}
                errors={errors}
                onBlurField={onBlurField}
              />
            </EntryCard>
          </Animated.View>
        );
      })}

      <AddSectionTile
        label="Role"
        onPress={() => onChange([...value, newRole()])}
        style={{ minHeight: s(ADD_ENTRY_STYLE.height), paddingHorizontal: s(ADD_ENTRY_STYLE.padX) }}
      />
    </View>
  );
}
