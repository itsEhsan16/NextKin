import { useState } from 'react';

import { SCORE_LABEL, SKILL_SUGGESTIONS } from '@/data/models';
import { useProfile, useUpdateSkills } from '@/data/queries';

import { countOf, listsEqual } from '../chipEdits';
import { ChipListEditor } from '../components/ChipListEditor';
import { useProfileActions } from '../hooks/useProfileActions';

/** A claim about our own rubric — never about any employer's software. */
const EMPTY = `Skills are what the ${SCORE_LABEL} counts when it reads a resume.`;

/**
 * The skill list on the career profile (V2 §7.3). Uncapped: the count line says how many there
 * are and leaves the judgement to the reader.
 */
export function SkillsScreen() {
  const actions = useProfileActions();
  const profile = useProfile();
  const save = useUpdateSkills();
  const [draft, setDraft] = useState<string[] | null>(null);

  // The draft is compared against the profile as it stands *now*, not against the copy it was
  // seeded from. An optimistic write makes the two agree the instant it starts, and a rollback
  // makes them disagree again — so a failed save leaves the edit on screen and Save live.
  const saved = profile.data?.skills;
  const items = draft ?? saved ?? [];
  const dirty = draft != null && saved != null && !listsEqual(draft, saved);

  return (
    <ChipListEditor
      title="Skills"
      noun="skill"
      items={items}
      suggestions={SKILL_SUGGESTIONS}
      placeholder="Type a skill"
      addLabel="Add a skill"
      countLine={(count) => countOf(count, 'skill')}
      emptyMessage={EMPTY}
      onChange={setDraft}
      loading={profile.isPending}
      error={profile.isError}
      onRetry={() => void profile.refetch()}
      dirty={dirty}
      saving={save.isPending}
      failed={save.isError}
      onSave={() => {
        if (draft) save.mutate(draft, { onSuccess: actions.goBack });
      }}
      onClose={actions.goBack}
    />
  );
}
