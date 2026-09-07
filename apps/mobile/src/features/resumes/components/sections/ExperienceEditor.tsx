import { View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import type { ContentRole } from '@/data/models';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';

import { newRole, removeAt, replaceAt } from '../../sectionEdits';
import { BulletRows } from './BulletRows';
import { EntryCard } from './EntryCard';
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
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();
  const layout = reduced ? undefined : LinearTransition.springify();

  const patch = (index: number, next: ContentRole) => onChange(replaceAt(value, index, next));

  return (
    <View style={{ gap: spacing[4] }}>
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
              needsReview={role.needsReview}
              deleteLabel={`Delete ${name}`}
              confirmMessage={`Delete ${role.title.trim() || name.toLowerCase()}? This cannot be undone from here.`}
              onDelete={() => onChange(removeAt(value, index))}
            >
              <TextField
                label="Job title"
                accessibilityLabel={`${name}, job title`}
                placeholder="Senior Product Designer"
                value={role.title}
                onChangeText={(text) => patch(index, { ...role, title: text })}
                onBlur={() => onBlurField?.(`${role.id}.title`)}
                error={errors[`${role.id}.title`]}
              />
              <TextField
                label="Company"
                accessibilityLabel={`${name}, company`}
                placeholder="PhonePe"
                value={role.company}
                onChangeText={(text) => patch(index, { ...role, company: text })}
                onBlur={() => onBlurField?.(`${role.id}.company`)}
                error={errors[`${role.id}.company`]}
              />
              <TextField
                label="Dates"
                accessibilityLabel={`${name}, dates`}
                placeholder="Mar 2022 — Present"
                value={role.period}
                onChangeText={(text) => patch(index, { ...role, period: text })}
                onBlur={() => onBlurField?.(`${role.id}.period`)}
                error={errors[`${role.id}.period`]}
              />
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

      <Button
        label="Add role"
        variant="secondary"
        icon="plus"
        block
        onPress={() => onChange([...value, newRole()])}
      />
    </View>
  );
}
