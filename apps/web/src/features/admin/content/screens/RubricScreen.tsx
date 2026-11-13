'use client';

import { useState } from 'react';

import type { RubricOverview } from '@nextkin/shared/models';
import { useAdminRubric, usePublishRubric } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';
import { AdminIcon } from '@/ui/animated/AdminIcon';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty } from '../../ui/AdminCard';
import { AdminDialog } from '../../ui/AdminDialog';
import { AdminPage } from '../../ui/AdminPage';
import { errorMessage } from '../format';
import { ImpactCard, RationaleCard } from '../rubric/RubricCards';
import { CompareDialog, HistoryDialog } from '../rubric/RubricCompare';
import { RationaleDialog } from '../rubric/RubricExtras';
import { ChecklistCard, CriteriaTable, VersionsList } from '../rubric/RubricParts';
import { ActionButton } from '../ui/ContentBits';

/**
 * ATS rubric (Figma 408:3123): how the ATS check weights each criterion, version by version. A
 * draft is dry-run on past checks before it goes live; it publishes only once its checklist is
 * complete (G15), and the version before it stays one click away.
 */
export function RubricScreen() {
  const rubric = useAdminRubric();
  if (rubric.isError) {
    return (
      <AdminPage title="ATS rubric">
        <StateView
          tone="danger"
          title="Couldn’t load the rubric"
          actionLabel="Try again"
          onAction={() => void rubric.refetch()}
        />
      </AdminPage>
    );
  }
  if (!rubric.data) {
    return (
      <AdminPage title="ATS rubric">
        <div aria-hidden className="grid gap-6 @admin-xl/admin:grid-cols-[320px_minmax(0,1fr)]">
          <Skeleton className="h-[366px] rounded-lg" />
          <Skeleton className="h-[536px] rounded-lg" />
        </div>
      </AdminPage>
    );
  }
  return <Loaded rubric={rubric.data} />;
}

function Loaded({ rubric }: { rubric: RubricOverview }) {
  const draft = rubric.versions.find((v) => v.status === 'draft');
  const active = rubric.versions.find((v) => v.status === 'active');
  const [viewing, setViewing] = useState(
    draft?.version ?? active?.version ?? rubric.versions[0]?.version ?? 0,
  );
  const [publishing, setPublishing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState<string | null>(null);
  const publish = usePublishRubric();

  const shown = rubric.versions.find((v) => v.version === viewing) ?? rubric.versions[0];
  const before = rubric.versions
    .filter((v) => shown && v.version < shown.version)
    .sort((a, b) => b.version - a.version)[0];
  const total = shown?.criteria.reduce((sum, c) => sum + c.weight, 0) ?? 0;
  const pending = rubric.checklist.filter((c) => c.state === 'pending');
  // The rationale and the dry run describe the draft; viewing another version, they say so.
  const scope = draft ? { version: draft.version, other: shown?.version !== draft.version } : null;

  if (!shown) {
    return (
      <AdminPage title="ATS rubric">
        <AdminCard icon="Scale02" title="Criteria">
          <CardEmpty
            title="No rubric yet"
            message="The first rubric version appears here once it's drafted."
          />
        </AdminCard>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="ATS rubric"
      subtitle="How the ATS check weights each criterion. Drafts are dry-run on past checks before they go live, and every publish is audited."
      actions={
        <div className="flex gap-3">
          {active && draft && (
            <ActionButton icon="SwitchHorizontal01" onClick={() => setComparing(true)}>
              Compare versions
            </ActionButton>
          )}
          {draft && (
            <ActionButton variant="primary" icon="Send01" onClick={() => setPublishing(true)}>
              Publish v{draft.version}
            </ActionButton>
          )}
        </div>
      }
    >
      <div className="grid items-start gap-6 @admin-xl/admin:grid-cols-[320px_minmax(0,1fr)]">
        <div className="grid gap-6 @admin-sm/admin:grid-cols-2 @admin-xl/admin:grid-cols-1">
          <VersionsList versions={rubric.versions} value={viewing} onChange={setViewing} />
          {draft && rubric.checklist.length > 0 && (
            <ChecklistCard
              version={draft.version}
              checklist={rubric.checklist}
              rollbackTo={active?.version ?? null}
            />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <AdminCard
            icon="Scale02"
            title={`Criteria · v${shown.version}${shown.status === 'draft' ? ' draft' : ''}`}
            trailing={
              <AdminBadge
                tone={total === 100 ? 'success' : 'danger'}
                icon={<AdminIcon name={total === 100 ? 'Check' : 'AlertTriangle'} size="xs" />}
              >
                Weights total {total}%
              </AdminBadge>
            }
            bodyClassName="p-0"
          >
            <CriteriaTable
              criteria={shown.criteria}
              previous={before?.criteria ?? null}
              previousVersion={before?.version ?? null}
              version={shown.version}
              onHistory={setHistory}
            />
          </AdminCard>

          {rubric.rationale && (
            <RationaleCard
              rationale={rubric.rationale}
              scope={scope}
              onEdit={draft ? () => setEditing(true) : null}
            />
          )}

          {rubric.impact && scope && (
            <ImpactCard
              impact={rubric.impact}
              scope={scope}
              activeVersion={active?.version ?? null}
            />
          )}
        </div>
      </div>

      {draft && (
        <AdminDialog
          open={publishing}
          onOpenChange={setPublishing}
          icon="Send01"
          tone={pending.length ? 'warning' : 'brand'}
          title={`Publish rubric v${draft.version}?`}
          description={
            pending.length
              ? `v${draft.version} can't be published yet: ${pending.map((p) => p.label.toLowerCase()).join(', ')} is still pending.`
              : `New ATS checks are scored with v${draft.version}. Past results keep the version they were scored with, and v${active?.version} stays one click away.`
          }
          confirm={{
            label: `Publish v${draft.version}`,
            disabled: pending.length > 0,
            busy: publish.isPending,
            onConfirm: () =>
              publish.mutate(draft.version, {
                onSuccess: () => {
                  showToast(`Rubric v${draft.version} is live`);
                  setPublishing(false);
                },
                onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
              }),
          }}
        />
      )}
      {active && draft && (
        <CompareDialog open={comparing} onOpenChange={setComparing} from={active} to={draft} />
      )}
      {history && (
        <HistoryDialog
          key={history}
          criterion={history}
          versions={rubric.versions}
          onClose={() => setHistory(null)}
        />
      )}
      {rubric.rationale && editing && (
        <RationaleDialog
          paragraphs={rubric.rationale.paragraphs}
          onClose={() => setEditing(false)}
        />
      )}
    </AdminPage>
  );
}
