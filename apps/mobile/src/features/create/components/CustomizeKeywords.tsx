import { useState } from 'react';
import { View } from 'react-native';

import type { TailorComparison, TailorKeyword } from '@/data/models';
import {
  keywordGroups,
  shownKeywords,
  tickKeyword,
  toggleAll,
  toggleKeyword,
  type CustomizeChoices,
} from '@/data/models/customize';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Disclosure } from '@/ui/Disclosure';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { KeywordToggleChips, type ToggleChipItem } from './KeywordToggleChips';
import { KEYWORD_CHIP, KeywordChips } from './TailorKeywords';

export type CustomizeKeywordsProps = {
  comparison: TailorComparison;
  choices: CustomizeChoices;
  onChange: (next: CustomizeChoices) => void;
};

/** A typed keyword is one phrase, not a paragraph. */
const MAX_KEYWORD = 60;

/** V2 §7.8 / D-14: nothing is ticked for the user, and a tick is their word that it is true. */
export const KEYWORDS_NOTE = 'Only tap what you really have. Interviewers may ask about it.';

/**
 * The keywords half of the Customize screen (toreview §114): what the resume already shows, then
 * the job's missing top keywords as tap-to-add chips, the soft skills, the rest folded under "More
 * keywords", Select all / Clear all over what is shown, and a field for one the job did not name.
 */
export function CustomizeKeywords({ comparison, choices, onChange }: CustomizeKeywordsProps) {
  const { colors, radii, spacing, s } = useTheme();
  const styles = useStyles();
  const [moreOpen, setMoreOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const groups = keywordGroups(comparison);
  const shown = shownKeywords(comparison);
  const matched = shown.filter((keyword) => keyword.onResume);
  const known = new Set(comparison.keywords.map((keyword) => keyword.label.toLowerCase()));
  const typed = choices.added.filter((label) => !known.has(label.toLowerCase()));
  const total = comparison.jobMatch?.total ?? shown.length;
  const covered = comparison.jobMatch?.matched ?? matched.length;

  const chips = (keywords: readonly TailorKeyword[]): ToggleChipItem[] =>
    keywords.map((keyword) => ({
      label: keyword.label,
      on: choices.added.includes(keyword.label),
      ...(keyword.quote ? { quote: keyword.quote } : {}),
    }));
  const toggle = (label: string, on: boolean) =>
    onChange(tickKeyword(choices, label, on, comparison.plan));

  const offered = [...groups.top, ...groups.soft, ...(moreOpen ? groups.more : [])].map(
    (keyword) => keyword.label,
  );
  const allOn = offered.length > 0 && offered.every((label) => choices.added.includes(label));

  const add = () => {
    const label = draft.trim();
    if (label.length > 0) onChange(toggleKeyword(choices, label, true));
    setDraft('');
    setAdding(false);
  };

  return (
    <View style={{ gap: spacing[4] }}>
      <View style={styles.heading}>
        <Text {...a11yHeader()} variant="title" style={styles.fill}>
          Job keywords
        </Text>
        <View
          style={[
            styles.count,
            { borderRadius: radii.full, backgroundColor: colors.warningSurface },
          ]}
        >
          <Text variant="microBadge" color="warningStrong" numberOfLines={1}>
            {`${covered} of ${total} on your resume`}
          </Text>
        </View>
      </View>

      {matched.length > 0 ? (
        <KeywordChips items={matched.map((keyword) => ({ label: keyword.label, have: true }))} />
      ) : null}

      {groups.top.length > 0 || typed.length > 0 ? (
        <View style={{ gap: s(KEYWORD_CHIP.headingToChips) }}>
          <Text variant="captionSemiBold">Tap the ones you have</Text>
          <KeywordToggleChips
            items={[...chips(groups.top), ...typed.map((label) => ({ label, on: true }))]}
            onToggle={toggle}
          />
        </View>
      ) : null}

      {groups.soft.length > 0 ? (
        <View style={{ gap: s(KEYWORD_CHIP.headingToChips) }}>
          <Text variant="captionSemiBold">Soft skills</Text>
          <KeywordToggleChips items={chips(groups.soft)} onToggle={toggle} />
        </View>
      ) : null}

      {groups.more.length > 0 ? (
        <Disclosure
          expanded={moreOpen}
          onToggle={() => setMoreOpen((open) => !open)}
          moreLabel={`More keywords (${groups.more.length})`}
          lessLabel="Fewer keywords"
        >
          <KeywordToggleChips items={chips(groups.more)} onToggle={toggle} />
        </Disclosure>
      ) : null}

      {adding ? (
        <TextField
          label="Add a keyword"
          value={draft}
          onChangeText={setDraft}
          placeholder="A skill the job asks for that you have"
          maxLength={MAX_KEYWORD}
          autoFocus
          returnKeyType="done"
          onSubmit={add}
        />
      ) : null}

      <View style={[styles.actions, { gap: spacing[2] }]}>
        {offered.length > 0 ? (
          <Button
            label={allOn ? 'Clear all' : 'Select all'}
            variant="ghost"
            onPress={() => onChange(toggleAll(choices, offered, comparison.plan))}
          />
        ) : null}
        {adding ? null : (
          <Button
            label="Add a keyword"
            icon="Plus"
            variant="ghost"
            onPress={() => setAdding(true)}
          />
        )}
      </View>

      <Text variant="micro" color="textSecondary">
        {KEYWORDS_NOTE}
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  heading: { flexDirection: 'row', alignItems: 'center', gap: s(KEYWORD_CHIP.headingGap) },
  fill: { flex: 1 },
  count: {
    paddingLeft: s(KEYWORD_CHIP.padLeft),
    paddingRight: s(KEYWORD_CHIP.padRight),
    paddingVertical: s(KEYWORD_CHIP.padY),
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
}));
