'use client';

import type { ResumeTemplate, TemplateStatus } from '@nextkin/shared/models';
import { useSetTemplateStatus } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { AdminIcon } from '@/ui/animated/AdminIcon';
import { Soon } from '@/ui/Soon';
import { Switch } from '@/ui/Switch';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard } from '../../ui/AdminCard';
import { adminButton, adminSoon } from '../../ui/adminButton';
import { errorMessage, formatCount, formatPaddedShort } from '../format';
import { RowMenu, type RowAction } from '../ui/RowMenu';
import { TemplateThumbnail } from './TemplateThumbnail';

const STATUS: Record<TemplateStatus, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  published: { label: 'Published', tone: 'success' },
  draft: { label: 'Draft', tone: 'warning' },
  archived: { label: 'Archived', tone: 'neutral' },
};

/** What the card says about use: in use, not yet, or still used though archived (407:1841). */
function usageOf(t: ResumeTemplate): string {
  if (t.status === 'archived') {
    const when = t.archivedAt ? ` · archived ${formatPaddedShort(t.archivedAt)}` : '';
    return t.inUse > 0
      ? `Still used by ${formatCount(t.inUse)} resumes${when}`
      : `Not in use${when}`;
  }
  if (t.inUse === 0)
    return `Not in use yet · edited ${formatPaddedShort(t.editedAt)} by ${t.editedBy}`;
  return `In use by ${formatCount(t.inUse)} resumes`;
}

/**
 * One template (Figma 407:1841): its sketch, whether it's certified ATS-safe, its state and
 * revision, how many resumes use it, and the publish switch. A template that hasn't passed its ATS
 * check can't be published (Q-06); one in use is archived, never deleted. The preview with sample
 * data is coming soon: nothing renders a template from a sample resume yet (toreview §171).
 */
export function TemplateCard({ template }: { template: ResumeTemplate }) {
  const set = useSetTemplateStatus();
  const published = template.status === 'published';
  const archived = template.status === 'archived';
  const locked = !template.atsSafe && !published && !archived;

  const change = (status: TemplateStatus, done: string) =>
    set.mutate(
      { slug: template.slug, status },
      {
        onSuccess: () => showToast(done),
        onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
      },
    );

  const actions: RowAction[] = [
    ...(template.status !== 'archived'
      ? [{ label: 'Archive', onSelect: () => change('archived', `${template.name} archived`) }]
      : [
          {
            label: 'Restore as draft',
            onSelect: () => change('draft', `${template.name} restored as a draft`),
          },
        ]),
  ];

  return (
    <AdminCard
      icon="File06"
      title={template.name}
      trailing={<RowMenu label={template.name} actions={actions} size="sm" />}
      bodyClassName="gap-3.5"
    >
      <TemplateThumbnail layout={template.layout} dimmed={archived} />
      <div className="flex flex-wrap items-center gap-1.5">
        {template.atsSafe ? (
          <AdminBadge tone="success" icon={<AdminIcon name="Check" size="xs" />}>
            ATS-safe
          </AdminBadge>
        ) : (
          <AdminBadge tone="warning" icon={<AdminIcon name="Clock" size="xs" />}>
            ATS check pending
          </AdminBadge>
        )}
        <AdminBadge tone={STATUS[template.status].tone} dot>
          {STATUS[template.status].label}
        </AdminBadge>
        {template.rev > 0 && <AdminBadge tone="neutral">rev {template.rev}</AdminBadge>}
      </div>
      <p className="text-body-s text-text-secondary">{usageOf(template)}</p>
      <div className="flex items-center gap-3 border-t border-neutral-100 pt-3.5">
        <Soon label="Previews with sample data are coming soon">
          <button
            type="button"
            aria-disabled="true"
            aria-label={`Preview ${template.name} with sample data`}
            className={cn(adminButton.small, adminSoon)}
          >
            <AdminIcon name="Eye" />
            Preview with sample data
          </button>
        </Soon>
        <span className="flex-1" />
        <span
          className={cn(
            'flex items-center gap-1 text-body-s font-medium',
            locked ? 'text-neutral-600' : 'text-neutral-700',
          )}
        >
          {locked && <AdminIcon name="Lock01" size="sm" className="text-neutral-400" />}
          {/* The board labels an archived template Unpublished too (Classic, 407:2366). */}
          {published ? 'Published' : locked ? 'Awaits sign-off' : 'Unpublished'}
        </span>
        <Switch
          checked={published}
          disabled={locked || set.isPending}
          label={`Publish ${template.name}`}
          onChange={(on) =>
            on
              ? change('published', `${template.name} is published`)
              : change('draft', `${template.name} is unpublished`)
          }
        />
      </div>
    </AdminCard>
  );
}
