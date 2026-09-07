import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useJdDraft, useStartGeneration, useSubscription, useUpdateJdDraft } from '@/data/queries';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';

import { JdReviewForm } from '../components/JdReviewForm';
import { JdReviewSkeleton } from '../components/JdReviewSkeleton';
import type { SkillGroupKey } from '../components/JdSkillGroup';
import { JdSkillMenuSheet, type JdSkillCommand } from '../components/JdSkillMenuSheet';
import { UsageBanner } from '../components/UsageBanner';
import { GENERATION_COST_NOTE, spentNote } from '../generationQuota';
import { addSkill as addSkillTo, moveSkill, removeSkill } from '../jdSkillEdits';
import { useJdReviewActions } from '../hooks/useJdReviewActions';

export type JdReviewScreenProps = {
  draftId: string;
  /** The document a tailored run starts from; threaded through from the tailor step (V2 §7.6). */
  baseResumeId?: string;
};

type SkillMenu = { group: SkillGroupKey; skill: string };
type MenuAction = 'move' | 'remove';

/** The primary's label, shared with the inert copy the loading state pins. */
const CTA = 'Generate resume';

/**
 * §7.6 forbids a silent hang. The reason goes on the bar that started the work, and the button
 * stays live so a second press is the retry.
 */
const START_FAILED = "We couldn't start it. Check your connection and try again.";

/**
 * CREATE — JD review (V2 §7.5). What the user confirms here is what generation, scoring and
 * cover letters read, so every extracted field is editable, skills move between the required and
 * preferred groups, and the original text stays on the page beside the extraction.
 *
 * Edits write straight through `useUpdateJdDraft`, which is optimistic: a chip has to land in
 * the other group under the finger rather than after the round trip, or the tap reads as dropped.
 *
 * This is also where a generation is actually spent, and §13.5 wants the cap in front of the
 * user before the work — the tailor intake's banner and gate are no help to the user who arrives
 * here straight from a failed run's "Edit the job description", so the quota is read here too.
 *
 * No artboard covers this flow (plan §8, phase 9), so it is built from the spec on the existing
 * primitives, tokens and motion.
 */
export function JdReviewScreen({ draftId, baseResumeId }: JdReviewScreenProps) {
  const { spacing } = useTheme();
  const actions = useJdReviewActions();

  const draft = useJdDraft(draftId);
  const subscription = useSubscription();
  const { mutate: patchDraft } = useUpdateJdDraft(draftId);
  const start = useStartGeneration();

  // The selection outlives the dismissal: `Sheet` keeps its subtree mounted through the exit
  // animation, so a menu nulled on close would blank its own title and drop both rows mid-slide.
  // The same split `notificationsStore` uses for its row menu.
  const [menu, setMenu] = useState<SkillMenu | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // `accessibilityLiveRegion` on the bar's note is Android-only, so the failure is announced
  // explicitly as well — once per falsy→truthy turn, the way TextField announces its error.
  const failed = start.isError;
  const announced = useRef(false);
  useEffect(() => {
    const was = announced.current;
    announced.current = failed;
    if (failed && !was) AccessibilityInfo.announceForAccessibility(START_FAILED);
  }, [failed]);

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

  // The inert bar is part of the loading state: it owns the bottom safe-area inset, so a page
  // without one would grow a 120pt footer out of nothing the moment the draft lands.
  //
  // The id is checked with it: `useJdDraft` is disabled on an empty one, and a disabled query
  // stays pending forever — without this the screen is a permanent skeleton with no way out.
  if ((draft.isPending && draftId.length > 0) || subscription.isPending) {
    return body(
      <JdReviewSkeleton />,
      <StickyActionBar primary={{ label: CTA, disabled: true }} note={GENERATION_COST_NOTE} />,
    );
  }

  if (draft.isError) {
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

  // An allowance that could not be read is unknown, not unlimited: nothing is spent against a cap
  // the page never showed (V2 §13.5).
  if (subscription.isError) {
    return body(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load your plan"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void subscription.refetch()}
      />,
    );
  }

  // No draft and no error: the id was empty or no longer resolves. Retrying a query that was
  // never enabled would do nothing, so the way out is the intake that makes a new one.
  if (!data) {
    return body(
      <StateView
        icon="file-alt"
        title="We couldn't find that job description"
        message="It may have been removed."
        actionLabel="Start a new one"
        onAction={actions.openTailor}
      />,
    );
  }

  const usage = subscription.data?.usage;
  const limit = usage?.generationsLimit ?? 0;
  const used = usage?.generationsUsed ?? 0;
  const spent = used >= limit;

  return (
    <>
      {body(
        <JdReviewForm
          draft={data}
          banner={<UsageBanner used={used} limit={limit} noun="generation" />}
          onPatch={patchDraft}
          onAddSkill={addSkill}
          onPressSkill={(group, skill) => {
            setMenu({ group, skill });
            setMenuOpen(true);
          }}
        />,
        <StickyActionBar
          // The banner above says how many are left; this line says what the press costs.
          note={failed ? START_FAILED : spent ? spentNote(limit) : GENERATION_COST_NOTE}
          primary={
            spent
              ? { label: 'See Pro plans', onPress: actions.openUpgrade }
              : { label: CTA, loading: start.isPending, onPress: generate }
          }
        />,
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
