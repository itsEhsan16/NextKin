import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { ContentProject } from '@/data/models';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { TextField, useFieldChain } from '@/ui/TextField';
import { layoutTransition } from '@/ui/motion';

import { newProject, removeAt, replaceAt } from '../../sectionEdits';
import { BulletRows } from './BulletRows';
import { AddSectionTile } from '../AddSectionTile';
import { EntryCard } from './EntryCard';
import { ADD_ENTRY_STYLE, CARD_STACK_GAP, FIELD_GAP } from './entryLayout';
import type { SectionFieldsProps } from './types';

/** V2 §7.11 — projects take the experience shape over name / description / bullets. */
export function ProjectsEditor({
  value,
  onChange,
  errors,
  onBlurField,
}: SectionFieldsProps<ContentProject[]>) {
  const { motion, s } = useTheme();
  const link = useFieldChain(value.length * 2);
  const reduced = useReducedMotion();
  const layout = layoutTransition(reduced);

  const patch = (index: number, next: ContentProject) => onChange(replaceAt(value, index, next));

  return (
    <View style={{ gap: s(CARD_STACK_GAP) }}>
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
              subtitle={project.name.trim() || undefined}
              tileName={project.name}
              needsReview={project.needsReview}
              deleteLabel={`Delete ${name}`}
              confirmMessage={`Delete ${project.name.trim() || name.toLowerCase()}? This cannot be undone from here.`}
              onDelete={() => onChange(removeAt(value, index))}
            >
              <View style={{ gap: s(FIELD_GAP) }}>
                <TextField
                  {...link(index * 2)}
                  label="Name"
                  accessibilityLabel={`${name}, name`}
                  placeholder="Checkout redesign"
                  value={project.name}
                  onChangeText={(text) => patch(index, { ...project, name: text })}
                  onBlur={() => onBlurField?.(`${project.id}.name`)}
                  error={errors[`${project.id}.name`]}
                />
                <TextField
                  ref={link(index * 2 + 1).ref}
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
              </View>
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

      <AddSectionTile
        label="Project"
        onPress={() => onChange([...value, newProject()])}
        style={{ minHeight: s(ADD_ENTRY_STYLE.height), paddingHorizontal: s(ADD_ENTRY_STYLE.padX) }}
      />
    </View>
  );
}
