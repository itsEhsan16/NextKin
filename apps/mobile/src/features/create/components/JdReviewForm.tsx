import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { JD_SOURCE_LABEL, type JdDraft, type JdDraftPatch } from '@/data/models';
import { useDebouncedValue, useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Disclosure } from '@/ui/Disclosure';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { JdSkillGroup, type SkillGroupKey } from './JdSkillGroup';

/** Trailing-edge debounce on the two text fields, so a keystroke is not a mutation. */
const FIELD_DEBOUNCE = 250;
/** Responsibilities past this fold away; §7.5 keeps every one of them reachable. */
const VISIBLE_RESPONSIBILITIES = 3;

/** Named per source, so the row never claims a paste that never happened. */
const SOURCE_TITLE: Record<JdDraft['source'], string> = {
  paste: 'What you pasted',
  file: 'What we read from your file',
  job: 'The listing we read',
};

export type JdReviewFormProps = {
  draft: JdDraft;
  onPatch: (patch: JdDraftPatch) => void;
  onAddSkill: (group: SkillGroupKey, skill: string) => void;
  onPressSkill: (group: SkillGroupKey, skill: string) => void;
};

/**
 * The extraction as an editable form (V2 §7.5): every field correctable, skills movable between
 * the two groups, and the source text still on the page underneath them.
 */
export function JdReviewForm({ draft, onPatch, onAddSkill, onPressSkill }: JdReviewFormProps) {
  const { spacing } = useTheme();
  const [title, setTitle] = useState(draft.title);
  const [company, setCompany] = useState(draft.company ?? '');
  const [showRest, setShowRest] = useState(false);
  const [showSource, setShowSource] = useState(false);

  const debouncedTitle = useDebouncedValue(title.trim(), FIELD_DEBOUNCE);
  const debouncedCompany = useDebouncedValue(company.trim(), FIELD_DEBOUNCE);

  // A title names every document generated from this JD, so an empty box is left unsaved rather
  // than written through as a nameless extraction.
  useEffect(() => {
    if (!debouncedTitle || debouncedTitle === draft.title) return;
    onPatch({ title: debouncedTitle });
  }, [debouncedTitle, draft.title, onPatch]);

  useEffect(() => {
    if (debouncedCompany === (draft.company ?? '')) return;
    onPatch({ company: debouncedCompany });
  }, [debouncedCompany, draft.company, onPatch]);

  const shown = draft.responsibilities.slice(0, VISIBLE_RESPONSIBILITIES);
  const rest = draft.responsibilities.slice(VISIBLE_RESPONSIBILITIES);
  const noSkills = draft.requiredSkills.length === 0 && draft.preferredSkills.length === 0;

  return (
    <>
      <Section index={0}>
        <Text variant="caption" color="textSecondary">
          {`${JD_SOURCE_LABEL[draft.source]} · edit anything we misread.`}
        </Text>
      </Section>

      <Section index={1}>
        <View style={{ gap: spacing[4] }}>
          <TextField
            label="Job title"
            value={title}
            onChangeText={setTitle}
            placeholder="The role this resume targets"
            autoCapitalize="words"
          />
          <TextField
            label="Company"
            value={company}
            onChangeText={setCompany}
            placeholder="Blank if the description names none"
            helper="We leave this empty rather than guess it."
            autoCapitalize="words"
          />
        </View>
      </Section>

      <Section index={2}>
        <View style={{ gap: spacing[4] }}>
          {/* Section-level, not page-level: the rest of the form is still usable. */}
          {noSkills ? (
            <StateView
              compact
              icon="tags"
              title="No skills found"
              message="Add what this job asks for — that is what the resume gets tailored to."
            />
          ) : null}
          <JdSkillGroup
            title="Required skills"
            kind="required"
            skills={draft.requiredSkills}
            onAdd={(skill) => onAddSkill('required', skill)}
            onPressSkill={(skill) => onPressSkill('required', skill)}
          />
        </View>
      </Section>

      <Section index={3}>
        <JdSkillGroup
          title="Preferred skills"
          kind="preferred"
          skills={draft.preferredSkills}
          onAdd={(skill) => onAddSkill('preferred', skill)}
          onPressSkill={(skill) => onPressSkill('preferred', skill)}
        />
      </Section>

      <Section index={4}>
        <View style={{ gap: spacing[3] }}>
          <Text variant="section" accessibilityRole="header">
            Responsibilities
          </Text>
          {shown.length === 0 ? (
            <Text variant="body" color="textSecondary">
              None found in this description.
            </Text>
          ) : (
            <Bullets lines={shown} />
          )}
          {rest.length > 0 ? (
            <Disclosure
              expanded={showRest}
              onToggle={() => setShowRest((open) => !open)}
              moreLabel={`Show ${rest.length} more`}
            >
              <Bullets lines={rest} />
            </Disclosure>
          ) : null}
        </View>
      </Section>

      <Section index={5}>
        <View style={{ gap: spacing[2] }}>
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

function Bullets({ lines }: { lines: readonly string[] }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing[2] }}>
      {lines.map((line) => (
        <View key={line} style={[styles.bullet, { gap: spacing[3] }]}>
          {/* The line beside it already reads as an item; the glyph would be announced twice. */}
          <Text
            variant="body"
            color="textSecondary"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            •
          </Text>
          <Text variant="body" color="textBody" style={styles.bulletText}>
            {line}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bullet: { flexDirection: 'row' },
  bulletText: { flex: 1 },
});
