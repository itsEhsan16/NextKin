import { useState, type ReactNode } from 'react';

import { useJdDraft, useStartGeneration, useUpdateJdDraft } from '@/data/queries';
import { useTheme } from '@/theme';
import { OptionSheet, type SheetOption } from '@/ui/OptionSheet';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';

import { JdReviewForm } from '../components/JdReviewForm';
import { JdReviewSkeleton } from '../components/JdReviewSkeleton';
import type { SkillGroupKey } from '../components/JdSkillGroup';
import { useJdReviewActions } from '../hooks/useJdReviewActions';

export type JdReviewScreenProps = {
  draftId: string;
  /** The document a tailored run starts from; threaded through from the tailor step (V2 §7.6). */
  baseResumeId?: string;
};

type SkillMenu = { group: SkillGroupKey; skill: string };
type MenuAction = 'move' | 'remove';

/**
 * CREATE — JD review (V2 §7.5). What the user confirms here is what generation, scoring and
 * cover letters read, so every extracted field is editable, skills move between the required and
 * preferred groups, and the original text stays on the page beside the extraction.
 *
 * Edits write straight through `useUpdateJdDraft`, which is optimistic: a chip has to land in
 * the other group under the finger rather than after the round trip, or the tap reads as dropped.
 *
 * No artboard covers this flow (plan §8, phase 9), so it is built from the spec on the existing
 * primitives, tokens and motion.
 */
export function JdReviewScreen({ draftId, baseResumeId }: JdReviewScreenProps) {
  const { spacing } = useTheme();
  const actions = useJdReviewActions();

  const draft = useJdDraft(draftId);
  const { mutate: patchDraft } = useUpdateJdDraft(draftId);
  const start = useStartGeneration();
  const [menu, setMenu] = useState<SkillMenu | null>(null);

  const data = draft.data;

  const addSkill = (group: SkillGroupKey, skill: string) => {
    if (!data) return;
    const current = group === 'required' ? data.requiredSkills : data.preferredSkills;
    if (current.some((entry) => entry.toLowerCase() === skill.toLowerCase())) return;
    const next = [...current, skill];
    patchDraft(group === 'required' ? { requiredSkills: next } : { preferredSkills: next });
  };

  const applyMenu = (action: MenuAction) => {
    setMenu(null);
    if (!data || !menu) return;
    const required = data.requiredSkills.filter((entry) => entry !== menu.skill);
    const preferred = data.preferredSkills.filter((entry) => entry !== menu.skill);
    if (action === 'remove') {
      patchDraft(
        menu.group === 'required' ? { requiredSkills: required } : { preferredSkills: preferred },
      );
      return;
    }
    // One patch carries both lists: the chip has to leave one group and land in the other in the
    // same optimistic write, or it blinks off the page in between.
    patchDraft(
      menu.group === 'required'
        ? { requiredSkills: required, preferredSkills: [...preferred, menu.skill] }
        : { preferredSkills: preferred, requiredSkills: [...required, menu.skill] },
    );
  };

  const menuOptions: readonly SheetOption<MenuAction>[] = menu
    ? [
        {
          key: 'move',
          label: menu.group === 'required' ? 'Move to preferred' : 'Move to required',
        },
        { key: 'remove', label: 'Remove' },
      ]
    : [];

  const generate = () => {
    start.mutate(
      { kind: 'resume', jdId: draftId, ...(baseResumeId ? { baseResumeId } : {}) },
      { onSuccess: (generation) => actions.openGeneration(generation.id) },
    );
  };

  const body = (children: ReactNode, footer?: ReactNode) => (
    <Screen
      keyboard
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Check what we read" onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: spacing[4] }}
      footer={footer}
      contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[6] }}
    >
      {children}
    </Screen>
  );

  if (draft.isPending) return body(<JdReviewSkeleton />);

  if (draft.isError || !data) {
    return body(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load this job description"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void draft.refetch()}
      />,
    );
  }

  return (
    <>
      {body(
        <JdReviewForm
          draft={data}
          onPatch={patchDraft}
          onAddSkill={addSkill}
          onPressSkill={(group, skill) => setMenu({ group, skill })}
        />,
        <StickyActionBar
          primary={{ label: 'Generate resume', loading: start.isPending, onPress: generate }}
          note="Counts as one of this month's generations"
        />,
      )}

      {/*
        Sibling of `Screen`, not a child of its scroller: the sheet's root is an absolute fill,
        which inside the scroll content box would cover the content rather than the page.
      */}
      <OptionSheet
        open={menu != null}
        title={menu?.skill ?? ''}
        options={menuOptions}
        selectedKey={undefined}
        onSelect={applyMenu}
        onClose={() => setMenu(null)}
      />
    </>
  );
}
