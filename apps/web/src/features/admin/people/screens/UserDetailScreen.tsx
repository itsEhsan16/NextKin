'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import type { AdminUserDetail, AdminUserResume } from '@nextkin/shared/models';
import { useAdminMe, useAdminUser } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { textLink } from '@/ui/textLink';

import { useAdminCrumb } from '../../shell/adminCrumb';
import { adminButton } from '../../ui/adminButton';
import { SecurityEventsCard } from '../components/SecurityEventsCard';
import { AccountCard, ResumesCard, UsageCard } from '../components/UserDetailCards';
import { detailPanelId, DetailTabs, detailTabId } from '../components/DetailTabs';
import { PersonAvatar } from '../components/PeopleBits';
import { RowMenu } from '../components/RowMenu';
import { copyWithToast } from '../components/StatsCaption';
import { AdminActionsCard, DangerZoneCard, PlanAccessCard } from '../components/UserSideCards';
import { CompProDialog, DeleteAccountDialog, PasswordResetDialog } from '../dialogs/AccountDialogs';
import { ResumeContentDialog } from '../dialogs/ResumeContentDialog';
import { ReactivateDialog, SuspendDialog } from '../dialogs/SuspendDialogs';
import { AVATAR_TINTS, formatDate, shortId } from '../peopleFormat';

type Tab = 'overview' | 'usage' | 'resumes' | 'security' | 'billing' | 'activity';
type Dialog = 'suspend' | 'reactivate' | 'reset' | 'delete' | { comp: number } | null;

/**
 * One user (Figma 406:2360): who they are, how much of their plan they've used, their resumes as
 * metadata, security events, billing and what staff have done to the account. Resume content
 * opens only through the reason dialog (407:2782). The page's own tabs narrow the left column;
 * the right column (plan, danger zone, admin actions) stays.
 */
export function UserDetailScreen({ id }: { id: string }) {
  const user = useAdminUser(id);
  useAdminCrumb(user.data?.name);
  const me = useAdminMe();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [resume, setResume] = useState<AdminUserResume | null>(null);
  const tabsId = useId();
  const can = (permission: string) => me.data?.permissions.some((p) => p === permission) ?? false;

  if (user.isPending) return <DetailSkeleton />;
  if (user.isError || !user.data) {
    return (
      <div className="px-8 pt-8">
        <StateView
          tone="danger"
          title="Couldn’t load this user"
          message="They may have been deleted, or the request failed."
          actionLabel="Try again"
          onAction={() => void user.refetch()}
        />
        <p className="text-center">
          <Link
            href={'/admin/users' as Route}
            className={cn(textLink, 'text-body-s font-semibold text-brand-700')}
          >
            Back to Users
          </Link>
        </p>
      </div>
    );
  }

  const data = user.data;
  const target = { id: data.id, name: data.name };
  const suspended = data.status === 'suspended';
  const manage = can('users.manage');

  return (
    <div className="flex flex-col gap-6 px-8 pb-10 pt-8">
      <header className="flex flex-wrap items-center gap-3">
        <PersonAvatar name={data.name} tint={AVATAR_TINTS[0]} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-display-l font-semibold tracking-[-0.015em] text-text-primary">
            {data.name}
          </h1>
          <p className="text-title-l font-normal tracking-normal text-text-secondary">
            {data.email} · user ID {shortId(data.id)} · joined {formatDate(data.signedUpAt)}
          </p>
        </div>
        {manage && (
          <>
            <HeaderButton icon="Key01" label="Reset password" onClick={() => setDialog('reset')} />
            <HeaderButton
              icon={suspended ? 'UserPlus01' : 'UserX01'}
              label={suspended ? 'Reactivate' : 'Suspend'}
              onClick={() => setDialog(suspended ? 'reactivate' : 'suspend')}
            />
          </>
        )}
        <RowMenu
          boxed
          label={data.name}
          actions={[
            {
              label: 'Copy user ID',
              onSelect: () => copyWithToast(data.id, 'User ID copied'),
            },
            { label: 'Open in audit log', onSelect: () => router.push('/admin/audit' as Route) },
            ...(manage
              ? [{ label: 'Comp Pro for 1 month', onSelect: () => setDialog({ comp: 1 }) }]
              : []),
          ]}
        />
      </header>

      <div className="grid items-start gap-6 @min-[1400px]/admin:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-6">
          <DetailTabs
            id={tabsId}
            label="Sections"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'usage', label: 'Usage' },
              { id: 'resumes', label: 'Resumes', count: data.resumeList?.length ?? data.resumes },
              { id: 'security', label: 'Security events', count: data.securityEventCount },
              { id: 'billing', label: 'Billing' },
              { id: 'activity', label: 'Activity' },
            ]}
          />
          <div
            role="tabpanel"
            id={detailPanelId(tabsId)}
            aria-labelledby={detailTabId(tabsId, tab)}
            className="flex flex-col gap-6"
          >
            <TabBody
              tab={tab}
              user={data}
              canOpen={can('users.content')}
              onOpenResume={setResume}
              onViewAllEvents={() => setTab('security')}
              onComp={(months) => setDialog({ comp: months })}
              manage={manage}
            />
          </div>
        </div>
        {/* A tab that shows one of these cards in full takes it out of the side column. */}
        <div className="flex flex-col gap-6">
          {tab !== 'billing' && (
            <PlanAccessCard
              user={data}
              canManage={manage}
              onComp={(months) => setDialog({ comp: months })}
            />
          )}
          <DangerZoneCard user={data} canManage={manage} onDelete={() => setDialog('delete')} />
          {tab !== 'activity' && <AdminActionsCard actions={data.adminActions} limit={4} />}
        </div>
      </div>

      <SuspendDialog
        user={target}
        open={dialog === 'suspend'}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      <ReactivateDialog
        user={target}
        open={dialog === 'reactivate'}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      <PasswordResetDialog
        user={target}
        open={dialog === 'reset'}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      <DeleteAccountDialog
        user={target}
        open={dialog === 'delete'}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      <CompProDialog
        user={target}
        months={typeof dialog === 'object' && dialog ? dialog.comp : 1}
        open={typeof dialog === 'object' && dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      <ResumeContentDialog user={target} resume={resume} onClose={() => setResume(null)} />
    </div>
  );
}

function TabBody({
  tab,
  user,
  canOpen,
  onOpenResume,
  onViewAllEvents,
  onComp,
  manage,
}: {
  tab: Tab;
  user: AdminUserDetail;
  canOpen: boolean;
  onOpenResume: (resume: AdminUserResume) => void;
  onViewAllEvents: () => void;
  onComp: (months: number) => void;
  manage: boolean;
}) {
  switch (tab) {
    case 'usage':
      return <UsageCard user={user} />;
    case 'resumes':
      return <ResumesCard user={user} canOpen={canOpen} onOpen={onOpenResume} />;
    case 'security':
      return <SecurityEventsCard events={user.securityEvents} />;
    case 'billing':
      return <PlanAccessCard user={user} canManage={manage} onComp={onComp} />;
    case 'activity':
      return <AdminActionsCard actions={user.adminActions} />;
    default:
      return (
        <div key="overview" className="flex animate-reveal flex-col gap-6">
          <div className="grid gap-6 @min-[900px]/admin:grid-cols-2">
            <AccountCard user={user} />
            <UsageCard user={user} />
          </div>
          <ResumesCard user={user} canOpen={canOpen} onOpen={onOpenResume} />
          <SecurityEventsCard events={user.securityEvents} limit={5} onViewAll={onViewAllEvents} />
        </div>
      );
  }
}

function HeaderButton({
  icon,
  label,
  onClick,
}: {
  icon: AdminIconName;
  label: string;
  onClick: () => void;
}) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <button type="button" onClick={onClick} {...hoverProps} className={adminButton.secondary}>
      <AdminIcon ref={iconRef} name={icon} />
      {label}
    </button>
  );
}

function DetailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6 px-8 pb-10 pt-8">
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-96" />
        </div>
      </div>
      <Skeleton className="h-[372px] w-full rounded-lg" />
      <Skeleton className="h-[320px] w-full rounded-lg" />
    </div>
  );
}
