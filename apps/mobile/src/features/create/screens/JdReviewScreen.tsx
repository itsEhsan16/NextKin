import { useState, type ReactNode } from 'react';

import { useJdDraft, useUpdateJdDraft } from '@/data/queries';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';

import { JdReviewForm } from '../components/JdReviewForm';
import { JdReviewSkeleton } from '../components/JdReviewSkeleton';
import type { SkillGroupKey } from '../components/JdSkillGroup';
import { JdSkillMenuSheet, type JdSkillCommand } from '../components/JdSkillMenuSheet';
import { addSkill as addSkillTo, moveSkill, removeSkill } from '../jdSkillEdits';
import { useJdReviewActions } from '../hooks/useJdReviewActions';

export type JdReviewScreenProps = { draftId: string };

type SkillMenu = { group: SkillGroupKey; skill: string };
type MenuAction = 'move' | 'remove';

/** The primary's label, shared with the inert copy the loading state pins. */
const CTA = 'Done';

/**
 * "Job details" (V2 §7.5, toreview §114): the job description as it was read, every field
 * editable, skills moved between the required and preferred groups, the original text beside it.
 * What the user confirms is what scoring and generation read. Never a step in front of a run:
 * Customize's "Details" and BUILD 04's pencil open it, and Done goes back to where they were.
 *
 * Edits write straight through `useUpdateJdDraft`, which is optimistic: a chip has to land in
 * the other group under the finger rather than after the round trip, or the tap reads as dropped.
 *
 * No artboard covers this flow (plan §8, phase 9), so it is built from the spec on the existing
 * primitives, tokens and motion.
 */
export function JdReviewScreen({ draftId }: JdReviewScreenProps) {
  const { spacing } = useTheme();
  const actions = useJdReviewActions();

  const draft = useJdDraft(draftId);
  const { mutate: patchDraft } = useUpdateJdDraft(draftId);

  // The selection outlives the dismissal: `Sheet` keeps its subtree mounted through the exit
  // animation, so a menu nulled on close would blank its own title and drop both rows mid-slide.
  const [menu, setMenu] = useState<SkillMenu | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const data = draft.data;

  // The rules — which list a group names, and that a skill may not sit in both — are
  // `jdSkillEdits`; this only turns a refusal into the field's error line.
  const addSkill = (group: SkillGroupKey, skill: string): string | undefined => {
    if (!data) return 'There is nothing to add it to yet.';
    const result = addSkillTo(data, group, skill);
    if ('refused' in result) return result.refused;
    patchDraft(result.patch);
    return undefined;
  };

  const applyMenu = (action: MenuAction) => {
    setMenuOpen(false);
    if (!data || !menu) return;
    const { group, skill } = menu;

    if (action === 'remove') {
      patchDraft(removeSkill(data, group, skill));
      return;
    }
    // Tools have no other group to move to; the menu never offers it for them.
    if (group === 'tools') return;
    patchDraft(moveSkill(data, group, skill));
  };

  const menuCommands: readonly JdSkillCommand<MenuAction>[] =
    menu == null || menu.group === 'tools'
      ? [{ key: 'remove', label: 'Remove', tone: 'danger' }]
      : [
          {
            key: 'move',
            label: menu.group === 'required' ? 'Move to preferred' : 'Move to required',
          },
          { key: 'remove', label: 'Remove', tone: 'danger' },
        ];

  const body = (children: ReactNode, footer?: ReactNode) => (
    <Screen
      keyboard
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Job details" onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: spacing[4] }}
      footer={footer}
      contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[6] }}
    >
      {children}
    </Screen>
  );

  // The inert bar is part of the loading state: it owns the bottom safe-area inset, so a page
  // without one would grow a 120pt footer out of nothing the moment the draft lands.
  //
  // The id is checked with it: `useJdDraft` is disabled on an empty one, and a disabled query
  // stays pending forever — without this the screen is a permanent skeleton with no way out.
  if (draft.isPending && draftId.length > 0) {
    return body(<JdReviewSkeleton />, <StickyActionBar primary={{ label: CTA, disabled: true }} />);
  }

  if (draft.isError) {
    return body(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load this job description"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void draft.refetch()}
      />,
    );
  }

  // No draft and no error: the id was empty or no longer resolves. Retrying a query that was
  // never enabled would do nothing, so the way out is the intake that makes a new one.
  if (!data) {
    return body(
      <StateView
        icon="File06"
        title="We couldn't find that job description"
        message="It may have been removed."
        actionLabel="Start a new one"
        onAction={actions.openTailor}
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
          onPressSkill={(group, skill) => {
            setMenu({ group, skill });
            setMenuOpen(true);
          }}
        />,
        <StickyActionBar primary={{ label: CTA, onPress: actions.goBack }} />,
      )}

      {/*
        Sibling of `Screen`, not a child of its scroller: the sheet's root is an absolute fill,
        which inside the scroll content box would cover the content rather than the page.
      */}
      <JdSkillMenuSheet
        open={menuOpen}
        title={menu?.skill ?? ''}
        commands={menuCommands}
        onSelect={applyMenu}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}
