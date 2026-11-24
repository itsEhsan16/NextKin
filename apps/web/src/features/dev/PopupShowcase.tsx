'use client';

import type { FigureDraft } from '@nextkin/shared/models';
import { useState } from 'react';

import { ApplyAskHost } from '@/features/applications/components/ApplyAskHost';
import { useApplyAskStore } from '@/features/applications/applyAsk';
import { CancelFacts } from '@/features/settings/components/PlanOverview';
import { ProblemsDialog } from '@/features/editor/components/EditorNotices';
import { VerifyEmailDialog } from '@/features/resumes/components/VerifyEmailDialog';
import { PlaceDialog, ResultDialog } from '@/features/tailor/flow/ScoreDialogs';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';

/**
 * The redesigned popups (owner boards, 2026-11-25) with sample content, to check each against its
 * board by eye. The consent and profile-sync dialogs open themselves from app state, so they are
 * not here; they draw the same `DialogHero` as the plan one.
 */
const PLACES = [
  { id: 'r1', label: 'Software Engineer · Google' },
  { id: 'r2', label: 'Software Development Engineer · Adobe' },
];

const DRAFT: FigureDraft = {
  before: 'Developed internal tools to streamline workflows, saving',
  after: ' of manual work a week.',
  hint: 'time saved',
  by: 'model',
  options: [
    {
      what: 'Time saved',
      before: 'Developed internal tools to streamline workflows, saving',
      after: ' of manual work a week.',
      amounts: ['2 hours', '5 hours', '10+ hours'],
    },
    {
      what: 'People using it',
      before: 'Developed internal tools used by',
      after: ' to streamline workflows.',
      amounts: ['20 people', '50 people'],
    },
  ],
};

type Open = 'place' | 'result' | 'verify' | 'problems' | 'cancel' | null;

export function PopupShowcase() {
  const [open, setOpen] = useState<Open>(null);
  const [where, setWhere] = useState<string[]>([]);
  const ask = useApplyAskStore((state) => state.open);
  const close = () => setOpen(null);
  const buttons: [Exclude<Open, null>, string][] = [
    ['place', 'Where did you use'],
    ['result', 'Add the result'],
    ['verify', 'Verify email'],
    ['problems', 'Before you download'],
    ['cancel', 'Cancel subscription'],
  ];
  return (
    <div className="flex flex-wrap items-center gap-3">
      {buttons.map(([key, label]) => (
        <Button key={key} variant="secondary" onClick={() => setOpen(key)}>
          {label}
        </Button>
      ))}
      <Button
        variant="secondary"
        onClick={() =>
          ask({
            id: 'showcase',
            title: 'Design Systems Engineer',
            company: 'Zalando',
          } as Parameters<typeof ask>[0])
        }
      >
        Did you apply
      </Button>
      <ApplyAskHost />
      <PlaceDialog
        open={open === 'place'}
        onOpenChange={(next) => !next && close()}
        keyword="React"
        need="Build product UI with React and TypeScript"
        places={PLACES}
        where={where}
        onToggle={(id, on) => setWhere((w) => (on ? [...w, id] : w.filter((x) => x !== id)))}
        onClear={() => setWhere([])}
      />
      <ResultDialog
        open={open === 'result'}
        onOpenChange={(next) => !next && close()}
        resumeId="showcase"
        bullet={{
          roleId: 'r1',
          index: 0,
          text: 'Developed internal tools to streamline workflows.',
        }}
        saved={undefined}
        draft={DRAFT}
        onSave={() => undefined}
      />
      <VerifyEmailDialog open={open === 'verify'} onClose={close} onRetry={() => undefined} />
      <ProblemsDialog
        open={open === 'problems'}
        problems={[{ section: 'experience', message: 'Google: add your job title.' }]}
        headingOf={() => 'Work Experience'}
        onClose={close}
      />
      <ConfirmDialog
        open={open === 'cancel'}
        title="Cancel your subscription?"
        art={{ src: '/illustrations/v2/plan-cancel.webp', width: 560, height: 467 }}
        message="You keep Pro until Dec 24, 2026, then move to the Free plan. Nothing more is charged."
        confirmLabel="Cancel subscription"
        cancelLabel="Keep Pro"
        tone="brand"
        onConfirm={close}
        onCancel={close}
      >
        <CancelFacts until="Dec 24, 2026" />
      </ConfirmDialog>
    </div>
  );
}
