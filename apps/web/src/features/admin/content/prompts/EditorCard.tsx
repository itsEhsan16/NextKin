'use client';

import { useEffect, useId, useRef, useState } from 'react';

import type { PromptDetail, PromptEditorTab } from '@nextkin/shared/models';
import { useCreatePromptDraft, useSavePromptDraft } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard } from '../../ui/AdminCard';
import { AdminDialog } from '../../ui/AdminDialog';
import { errorMessage, sinceLabel } from '../format';
import { ActionButton } from '../ui/ContentBits';
import { CodeEditor, DiffView, variablesIn } from './CodeEditor';
import { EditorTabs, editorTabIds } from './EditorTabs';

const TABS: { id: PromptEditorTab; label: string }[] = [
  { id: 'system', label: 'System prompt' },
  { id: 'user', label: 'User template' },
  { id: 'schema', label: 'Output schema' },
  { id: 'settings', label: 'Settings' },
];

const AUTOSAVE_MS = 1500;

/**
 * The draft's text, by part (Figma 407:3141): system prompt, user template, output schema and
 * settings. It saves itself a moment after typing stops, when the field loses focus and when the
 * card goes (leaving the page, a publish); Save draft saves at once. An edited draft needs a
 * fresh eval before it can be published. Diff compares the tab with the live version. With no
 * draft open, the live version is shown read-only and Start a draft opens one.
 */
export function EditorCard({ detail }: { detail: PromptDetail }) {
  const [tab, setTab] = useState<PromptEditorTab>('system');
  const saved = detail.editor[tab];
  const [text, setText] = useState(saved);
  // When the saved text changes underneath (a save landed, a draft opened), follow it unless the
  // field holds edits of its own.
  const [base, setBase] = useState(saved);
  if (base !== saved) {
    setBase(saved);
    if (text === base) setText(saved);
  }
  const [diffing, setDiffing] = useState(false);
  const save = useSavePromptDraft(detail.name);
  const start = useCreatePromptDraft();
  const editable = detail.draft !== null;
  const dirty = text !== saved;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = (next = text, quiet = false) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (next === saved) return;
    save.mutate(
      { tab, text: next },
      {
        onSuccess: () => !quiet && showToast('Draft saved'),
        onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
      },
    );
  };

  // What the unmount flush needs, kept fresh after each render.
  const latest = useRef({ tab, text, saved, editable, mutate: save.mutate });
  useEffect(() => {
    latest.current = { tab, text, saved, editable, mutate: save.mutate };
  });
  // A pending autosave is sent, not dropped, when the card goes.
  useEffect(
    () => () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      const pending = latest.current;
      if (pending.editable && pending.text !== pending.saved) {
        pending.mutate({ tab: pending.tab, text: pending.text });
      }
    },
    [],
  );
  const idBase = useId();
  const ids = editorTabIds(idBase, tab);

  const onType = (next: string) => {
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      commit(next, true);
    }, AUTOSAVE_MS);
  };
  const onBlur = () => {
    if (timer.current) commit(text, true);
  };

  const switchTab = (next: PromptEditorTab) => {
    if (dirty) commit(text, true);
    setTab(next);
    setText(detail.editor[next]);
    setBase(detail.editor[next]);
  };

  const lines = text.split('\n').length;
  const variables = variablesIn(text).length;
  const status = save.isPending
    ? 'Saving…'
    : dirty
      ? 'Unsaved changes'
      : detail.autosavedAt
        ? `Autosaved ${sinceLabel(detail.autosavedAt)}`
        : 'Saved';

  return (
    <AdminCard
      icon="Code02"
      title="Editor"
      trailing={
        editable ? (
          <AdminBadge tone="brand" dot>
            Editing v{detail.draft!.version} draft
          </AdminBadge>
        ) : (
          <AdminBadge tone="neutral">Viewing v{detail.activeVersion} · live</AdminBadge>
        )
      }
      bodyClassName="gap-4"
    >
      <EditorTabs
        label="Prompt part"
        options={TABS}
        value={tab}
        onChange={switchTab}
        idBase={idBase}
      />
      <div role="tabpanel" id={ids.panel} aria-labelledby={ids.tab}>
        <CodeEditor
          value={text}
          onChange={onType}
          onBlur={onBlur}
          readOnly={!editable}
          label={`${TABS.find((t) => t.id === tab)?.label ?? 'Prompt'} text`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p
          className="flex flex-1 items-center gap-3 whitespace-nowrap text-caption-m font-normal text-text-secondary"
          aria-live="polite"
        >
          <AdminIcon name="Clock" size="sm" className="text-neutral-400" />
          {editable ? status : 'Live version, read-only'} · {variables}{' '}
          {variables === 1 ? 'variable' : 'variables'} · {lines} {lines === 1 ? 'line' : 'lines'}
        </p>
        {detail.activeEditor && editable && (
          <ActionButton variant="small" icon="SwitchHorizontal01" onClick={() => setDiffing(true)}>
            Diff against v{detail.activeVersion}
          </ActionButton>
        )}
        {editable ? (
          <ActionButton
            variant="small"
            onClick={() => (dirty ? commit() : showToast('The draft is already saved'))}
            busy={save.isPending}
          >
            Save draft
          </ActionButton>
        ) : (
          <ActionButton
            variant="small"
            icon="Plus"
            busy={start.isPending}
            onClick={() =>
              start.mutate(detail.name, {
                onSuccess: (next) => showToast(`v${next.draft?.version} draft started`),
                onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
              })
            }
          >
            Start a draft
          </ActionButton>
        )}
      </div>

      {detail.activeEditor && (
        <AdminDialog
          open={diffing}
          onOpenChange={setDiffing}
          icon="SwitchHorizontal01"
          tone="brand"
          width="lg"
          title={`v${detail.draft?.version ?? detail.activeVersion} against v${detail.activeVersion}`}
          description={`${TABS.find((t) => t.id === tab)?.label}: lines removed from the live version, and lines the draft adds.`}
        >
          <DiffView before={detail.activeEditor[tab]} after={text} />
        </AdminDialog>
      )}
    </AdminCard>
  );
}
