'use client';

import { useState } from 'react';

import { useSaveRationale } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';

import { AdminDialog } from '../../ui/AdminDialog';
import { TextArea } from '../../ui/AdminForm';
import { errorMessage } from '../format';
import { ShareBar } from './ShareBar';

/** A pass rate as a labelled two-segment bar (Figma 408:3123 "Score impact", 409:2528). */
export function PassRate({ label, rate, fill }: { label: string; rate: number; fill: string }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-body-s">
        <span className="flex-1 font-medium text-neutral-700">{label}</span>
        <span className="font-semibold text-text-primary">{pct}%</span>
      </div>
      <ShareBar value={pct} label={label} fill={fill} />
    </div>
  );
}

export function RationaleDialog({
  paragraphs,
  onClose,
}: {
  paragraphs: string[];
  onClose: () => void;
}) {
  const save = useSaveRationale();
  const [text, setText] = useState(paragraphs.join('\n\n'));
  return (
    <AdminDialog
      open
      onOpenChange={(open) => !open && onClose()}
      icon="Edit03"
      tone="brand"
      width="lg"
      title="Edit the rationale"
      description="Say why each weight moved and what evidence backs it (G15). Separate paragraphs with a blank line."
      confirm={{
        label: 'Save rationale',
        disabled: !text.trim(),
        busy: save.isPending,
        onConfirm: () =>
          save.mutate(
            text
              .split(/\n\s*\n/)
              .map((p) => p.trim())
              .filter(Boolean),
            {
              onSuccess: () => {
                showToast('Rationale saved');
                onClose();
              },
              onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
            },
          ),
      }}
    >
      <TextArea
        label="Rationale"
        required
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-[260px]"
      />
    </AdminDialog>
  );
}
