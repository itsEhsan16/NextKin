'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { PromptStage } from '@nextkin/shared/models';
import { useCreatePromptDraft } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';

import { AdminDialog } from '../../ui/AdminDialog';
import { RadioCardGroup } from '../../ui/AdminForm';
import { errorMessage } from '../format';
import { promptHref } from './PromptsTable';

/**
 * "New draft" (Figma 406:662): which stage to draft. A draft starts from the stage's live version
 * and opens on the stage's page; a stage that already has a draft opens that draft instead.
 */
export function NewDraftDialog({
  open,
  onOpenChange,
  stages,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: PromptStage[];
}) {
  const router = useRouter();
  const create = useCreatePromptDraft();
  const [stage, setStage] = useState<string | null>(null);

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      icon="Plus"
      tone="brand"
      title="New prompt draft"
      description="The draft starts from the stage's active version. It can't go live until it passes its eval."
      confirm={{
        label: 'Create draft',
        disabled: !stage,
        busy: create.isPending,
        onConfirm: () => {
          if (!stage) return;
          create.mutate(stage, {
            onSuccess: (detail) => {
              showToast(
                `v${detail.draft?.version ?? detail.activeVersion} draft of ${stage} is open`,
              );
              onOpenChange(false);
              router.push(promptHref(stage));
            },
            onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
          });
        },
      }}
    >
      <div className="max-h-[360px] overflow-y-auto">
        <RadioCardGroup
          label="Stage"
          required
          value={stage}
          onChange={setStage}
          options={stages.map((s) => ({
            id: s.name,
            label: s.name,
            description: s.draft ? `Has a v${s.draft.version} draft already` : s.description,
          }))}
        />
      </div>
    </AdminDialog>
  );
}
