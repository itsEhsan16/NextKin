'use client';

import type { Route } from 'next';
import { useState } from 'react';

import type { PromptDetail } from '@nextkin/shared/models';
import { useAdminPrompt, usePublishPrompt, useRollbackPrompt } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { useAdminCrumb } from '../../shell/adminCrumb';
import { AdminDialog } from '../../ui/AdminDialog';
import { AdminPage } from '../../ui/AdminPage';
import { EditorCard } from '../prompts/EditorCard';
import { ChangeNoteCard, EvalCard, PublishGateAlert } from '../prompts/EvalCard';
import { SandboxCard } from '../prompts/SandboxCard';
import { StageCard, VersionsCard } from '../prompts/VersionsCard';
import { errorMessage, formatScore } from '../format';
import { formatPromptDay } from '../prompts/promptDates';
import { ActionButton, TextAction } from '../ui/ContentBits';

/**
 * One pipeline stage's prompt (Figma 407:3141): its versions and stage facts on the left, the
 * draft's editor and sandbox in the middle, and its eval and change note on the right. Publish is
 * refused without a passing eval; rolling back to the previous version is one click.
 */
export function PromptDetailScreen({ name }: { name: string }) {
  const prompt = useAdminPrompt(name);
  // The board's breadcrumb ends on the prompt: Content › AI prompts › tailor.rewrite (407:3141).
  useAdminCrumb(name);

  if (prompt.isError) {
    return (
      <AdminPage title={name}>
        <div className="flex flex-col items-center">
          <StateView
            tone="danger"
            title="Couldn’t load this prompt"
            message={errorMessage(prompt.error)}
            actionLabel="Try again"
            onAction={() => void prompt.refetch()}
            className="pb-4"
          />
          <TextAction href={'/admin/prompts' as Route} className="self-center">
            Back to AI prompts
          </TextAction>
        </div>
      </AdminPage>
    );
  }
  if (!prompt.data) {
    return (
      <AdminPage title={name} subtitle={<Skeleton as="span" className="inline-block h-5 w-96" />}>
        <div aria-hidden className="grid grid-cols-[320px_minmax(0,1fr)_400px] gap-6">
          <Skeleton className="h-[460px] rounded-lg" />
          <Skeleton className="h-[600px] rounded-lg" />
          <Skeleton className="h-[420px] rounded-lg" />
        </div>
      </AdminPage>
    );
  }
  return <Loaded detail={prompt.data} />;
}

function Loaded({ detail }: { detail: PromptDetail }) {
  const [publishing, setPublishing] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const publish = usePublishPrompt(detail.name);
  const rollback = useRollbackPrompt(detail.name);

  const previous = detail.versions
    .filter((v) => v.version < detail.activeVersion)
    .sort((a, b) => b.version - a.version)[0];
  const draft = detail.draft;
  const ready = Boolean(draft && detail.eval?.version === draft.version && detail.eval.passed);

  // "Rewrites resume bullets toward the job. Active v14 since Nov 5 · Draft v15 by Marco K."
  const live = `Active v${detail.activeVersion} since ${formatPromptDay(detail.activeSince, false)}`;
  const drafted = draft
    ? ` · Draft v${draft.version}${draft.author ? ` by ${draft.author}` : ''}`
    : '';
  const subtitle = `${detail.description ? `${detail.description}. ` : ''}${live}${drafted}`;

  return (
    <AdminPage
      title={detail.name}
      subtitle={subtitle}
      actions={
        <div className="flex gap-3">
          {previous && (
            <ActionButton icon="FlipBackward" onClick={() => setRollingBack(true)}>
              Roll back to v{previous.version}
            </ActionButton>
          )}
          {draft && (
            <ActionButton variant="primary" onClick={() => setPublishing(true)}>
              Publish v{draft.version}
            </ActionButton>
          )}
        </div>
      }
    >
      <div className="grid items-start gap-6 @admin-2xl/admin:grid-cols-[320px_minmax(0,1fr)_400px]">
        <div className="grid gap-6 @admin-md/admin:grid-cols-2 @admin-2xl/admin:grid-cols-1">
          <VersionsCard detail={detail} />
          {detail.stage && <StageCard stage={detail.stage} />}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <EditorCard key={`${detail.name}:${draft?.version ?? 'live'}`} detail={detail} />
          <SandboxCard detail={detail} />
        </div>
        <div className="flex flex-col gap-6">
          <EvalCard detail={detail} />
          <PublishGateAlert />
          <ChangeNoteCard key={draft?.version ?? 'live'} detail={detail} />
        </div>
      </div>

      {draft && (
        <AdminDialog
          open={publishing}
          onOpenChange={setPublishing}
          icon="Send01"
          tone={ready ? 'brand' : 'warning'}
          title={`Publish ${detail.name} v${draft.version}?`}
          description={
            ready
              ? `v${draft.version} replaces v${detail.activeVersion} for every run from now on. It passed its eval at ${formatScore(detail.eval!.score)}. The publish is written to the audit log, and rolling back stays one click away.`
              : `v${draft.version} hasn't passed an eval yet, so it can't be published. Run its eval first.`
          }
          confirm={{
            label: `Publish v${draft.version}`,
            // Only a draft that passed its eval can go live; the dialog says why when it can't.
            disabled: !ready,
            busy: publish.isPending,
            onConfirm: () =>
              publish.mutate(draft.version, {
                onSuccess: () => {
                  showToast(`v${draft.version} is live`);
                  setPublishing(false);
                },
                onError: (error) => {
                  showToast(errorMessage(error), { tone: 'error' });
                  setPublishing(false);
                },
              }),
          }}
        />
      )}
      {previous && (
        <AdminDialog
          open={rollingBack}
          onOpenChange={setRollingBack}
          icon="FlipBackward"
          tone="warning"
          title={`Roll back to v${previous.version}?`}
          description={`v${previous.version} goes live again straight away, replacing v${detail.activeVersion}. Nothing is deleted, and the rollback is written to the audit log.`}
          confirm={{
            label: `Roll back to v${previous.version}`,
            busy: rollback.isPending,
            onConfirm: () =>
              rollback.mutate(previous.version, {
                onSuccess: () => {
                  showToast(`v${previous.version} is live again`);
                  setRollingBack(false);
                },
                onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
              }),
          }}
        />
      )}
    </AdminPage>
  );
}
