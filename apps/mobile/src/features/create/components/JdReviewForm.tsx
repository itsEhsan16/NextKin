import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  EXPERIENCE_LEVEL_LABEL,
  JD_SOURCE_LABEL,
  type ExperienceLevel,
  type JdDraft,
  type JdDraftPatch,
} from '@/data/models';
import { useDebouncedValue, useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { FilterChip } from '@/ui/Chip';
import { Disclosure } from '@/ui/Disclosure';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { JdResponsibilities } from './JdResponsibilities';
import { JdSkillGroup, type SkillGroupKey } from './JdSkillGroup';

/** Trailing-edge debounce on the short header fields, so a keystroke is not a mutation. */
const FIELD_DEBOUNCE = 250;

/** Named per source, so the row never claims a paste that never happened. */
const SOURCE_TITLE: Record<JdDraft['source'], string> = {
  paste: 'What you pasted',
  file: 'What we read from your file',
  job: 'The listing we read',
  link: 'What we read from the link',
};

const LEVELS: readonly ExperienceLevel[] = ['entry', 'mid', 'senior', 'lead'];

export type JdReviewFormProps = {
  draft: JdDraft;
  onPatch: (patch: JdDraftPatch) => void;
  /** Returns the reason the entry was refused, or nothing when it went in. */
  onAddSkill: (group: SkillGroupKey, skill: string) => string | undefined;
  onPressSkill: (group: SkillGroupKey, skill: string) => void;
  /** The quota card the screen owns, folded into the stagger as the form's first section. */
  banner?: ReactNode;
};

/**
 * The extraction as an editable form (V2 §7.5): every field the extractor fills is correctable —
 * title, company, location, industry, seniority, both skill groups, tools and responsibilities —
 * skills move between the two groups, and the source text is still on the page underneath them.
 */
export function JdReviewForm({
  draft,
  onPatch,
  onAddSkill,
  onPressSkill,
  banner,
}: JdReviewFormProps) {
  const { spacing } = useTheme();
  const [showSource, setShowSource] = useState(false);

  const setTitle = useCallback((title: string) => onPatch({ title }), [onPatch]);
  const setCompany = useCallback((company: string) => onPatch({ company }), [onPatch]);
  const setLocation = useCallback((location: string) => onPatch({ location }), [onPatch]);
  const setDomain = useCallback((domain: string) => onPatch({ domain }), [onPatch]);
  const setResponsibilities = useCallback(
    (responsibilities: string[]) => onPatch({ responsibilities }),
    [onPatch],
  );

  const noSkills = draft.requiredSkills.length === 0 && draft.preferredSkills.length === 0;

  return (
    <>
      {banner ? <Section index={0}>{banner}</Section> : null}

      <Section index={1}>
        <Text variant="caption" color="textSecondary">
          {JD_SOURCE_LABEL[draft.source]}
        </Text>
      </Section>

      <Section index={2}>
        <View style={{ gap: spacing[4] }}>
          <DebouncedField
            label="Job title"
            value={draft.title}
            placeholder="The role this resume targets"
            // A title names every document generated from this JD, so an empty box is left
            // unsaved rather than written through as a nameless extraction.
            required
            onCommit={setTitle}
          />
          <DebouncedField
            label="Company"
            value={draft.company ?? ''}
            placeholder="Blank if the description names none"
            helper="We leave this empty rather than guess it."
            onCommit={setCompany}
          />
        </View>
      </Section>

      <Section index={3}>
        <View style={{ gap: spacing[4] }}>
          <DebouncedField
            label="Location"
            value={draft.location ?? ''}
            placeholder="City, or how remote it is"
            onCommit={setLocation}
          />
          <DebouncedField
            label="Industry"
            value={draft.domain ?? ''}
            placeholder="The domain this job sits in"
            onCommit={setDomain}
          />
          <View style={{ gap: spacing[3] }}>
            <Text variant="groupLabel">Experience level</Text>
            <View style={[styles.chips, { gap: spacing[2] }]}>
              {LEVELS.map((level) => (
                <FilterChip
                  key={level}
                  label={EXPERIENCE_LEVEL_LABEL[level]}
                  variant="select"
                  selected={draft.experienceLevel === level}
                  // Picking the one already picked is a no-op rather than a clear: drafts are
                  // stored through a JSON round trip, which drops an undefined-valued key, so a
                  // "clear" would be written and then read straight back as the old level.
                  onPress={() => {
                    if (draft.experienceLevel !== level) onPatch({ experienceLevel: level });
                  }}
                />
              ))}
            </View>
          </View>
        </View>
      </Section>

      <Section index={4}>
        <View style={{ gap: spacing[4] }}>
          {/* Section-level, not page-level: the rest of the form is still usable. */}
          {noSkills ? <StateView compact icon="tags" title="No skills found" /> : null}
          <JdSkillGroup
            title="Required skills"
            noun="required skill"
            skills={draft.requiredSkills}
            onAdd={(skill) => onAddSkill('required', skill)}
            onPressSkill={(skill) => onPressSkill('required', skill)}
          />
        </View>
      </Section>

      <Section index={5}>
        <JdSkillGroup
          title="Preferred skills"
          noun="preferred skill"
          skills={draft.preferredSkills}
          onAdd={(skill) => onAddSkill('preferred', skill)}
          onPressSkill={(skill) => onPressSkill('preferred', skill)}
        />
      </Section>

      <Section index={6}>
        <JdSkillGroup
          title="Tools"
          noun="tool"
          skills={draft.tools}
          onAdd={(skill) => onAddSkill('tools', skill)}
          onPressSkill={(skill) => onPressSkill('tools', skill)}
        />
      </Section>

      <Section index={7}>
        <JdResponsibilities lines={draft.responsibilities} onChange={setResponsibilities} />
      </Section>

      <Section index={8}>
        <View style={{ gap: spacing[4] }}>
          <Text variant="section" accessibilityRole="header">
            Original text
          </Text>
          <Disclosure
            mode="row"
            title={SOURCE_TITLE[draft.source]}
            expanded={showSource}
            onToggle={() => setShowSource((open) => !open)}
          >
            <Text variant="prose" color="textBody">
              {draft.rawText}
            </Text>
          </Disclosure>
        </View>
      </Section>
    </>
  );
}

type DebouncedFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  helper?: string;
  /** A field the draft cannot do without: an empty box is left unsaved rather than written. */
  required?: boolean;
  onCommit: (value: string) => void;
};

/** A header field that writes through 250ms after the last keystroke rather than on each one. */
function DebouncedField({
  label,
  value,
  placeholder,
  helper,
  required = false,
  onCommit,
}: DebouncedFieldProps) {
  const [text, setText] = useState(value);
  const debounced = useDebouncedValue(text.trim(), FIELD_DEBOUNCE);

  useEffect(() => {
    if (debounced === value) return;
    if (required && !debounced) return;
    onCommit(debounced);
  }, [debounced, onCommit, required, value]);

  return (
    <TextField
      label={label}
      value={text}
      onChangeText={setText}
      placeholder={placeholder}
      helper={helper}
      autoCapitalize="words"
    />
  );
}

/** Sections fade-slide in on first paint, 40ms apart (motion.stagger.card). */
function Section({ index, children }: { index: number; children: ReactNode }) {
  const { motion } = useTheme();
  const reduced = useReducedMotion();
  if (reduced) return <View>{children}</View>;
  return (
    <Animated.View
      entering={FadeInDown.delay(index * motion.stagger.card).duration(motion.durations.base)}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
