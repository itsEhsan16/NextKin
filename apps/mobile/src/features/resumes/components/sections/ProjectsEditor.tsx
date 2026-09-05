import { View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import type { ContentProject } from '@/data/models';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';

import { newProject, removeAt, replaceAt } from '../../sectionEdits';
import { BulletRows } from './BulletRows';
import { EntryCard } from './EntryCard';
import type { SectionFieldsProps } from './types';

/** V2 §7.11 — projects take the experience shape over name / description / bullets. */
export function ProjectsEditor({
  value,
  onChange,
  errors,
  onBlurField,
}: SectionFieldsProps<ContentProject[]>) {
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();
  const layout = reduced ? undefined : LinearTransition.springify();

  const patch = (index: number, next: ContentProject) => onChange(replaceAt(value, index, next));

  return (
    <View style={{ gap: spacing[4] }}>
      {value.map((project, index) => {
        const name = `Project ${index + 1}`;
        return (
          <Animated.View
            key={project.id}
            layout={layout}
            entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}
          >
            <EntryCard
              title={name}
              needsReview={project.needsReview}
              deleteLabel={`Delete ${name}`}
              confirmMessage={`Delete ${project.name.trim() || name.toLowerCase()}? This cannot be undone from here.`}
              onDelete={() => onChange(removeAt(value, index))}
            >
              <TextField
                label="Name"
                accessibilityLabel={`${name}, name`}
                placeholder="Checkout redesign"
                value={project.name}
                onChangeText={(text) => patch(index, { ...project, name: text })}
                onBlur={() => onBlurField?.(`${project.id}.name`)}
                error={errors[`${project.id}.name`]}
              />
              <TextField
                label="Description"
                accessibilityLabel={`${name}, description`}
                placeholder="One line on what it was and who it was for."
                value={project.description}
                onChangeText={(text) => patch(index, { ...project, description: text })}
                onBlur={() => onBlurField?.(`${project.id}.description`)}
                error={errors[`${project.id}.description`]}
                multiline
                minLines={3}
              />
              <BulletRows
                entryId={project.id}
                entryName={name}
                bullets={project.bullets}
                onChange={(bullets) => patch(index, { ...project, bullets })}
                errors={errors}
                onBlurField={onBlurField}
              />
            </EntryCard>
          </Animated.View>
        );
      })}

      <Button
        label="Add project"
        variant="secondary"
        icon="plus"
        block
        onPress={() => onChange([...value, newProject()])}
      />
    </View>
  );
}
