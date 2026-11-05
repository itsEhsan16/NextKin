import type { Route } from 'next';
import { notFound } from 'next/navigation';

import { ComingSoon } from '@/ui/ComingSoon';

import { adminItemBySegment } from '../shell/adminNav';

/** What each admin page will do, in its own words (V2 §7.17, P12; the boards on 382:936). */
const WHAT: Record<string, string> = {
  users:
    'Search users by email, name or ID, see their plan and usage, and suspend or reactivate with a reason.',
  staff: 'See who has a staff role, and grant or remove roles. Every change is audited.',
  deletions: 'Work through account deletion requests before their 30-day limit.',
  prompts: 'Draft, evaluate and publish the AI prompts, and roll back in one click.',
  technologies:
    'Curate the technology knowledge base and approve or reject the changes waiting for review.',
  skills: 'Manage the skills list and the aliases that map to each skill.',
  templates: 'Publish, draft or archive resume templates once they are certified ATS-safe.',
  rubric: 'Read the ATS rubric versions, their weights and the evidence behind them.',
  plans: 'Set plan prices per currency and the quotas each plan includes.',
  analytics: 'Product analytics across the platform, aggregate only.',
  providers: 'Turn job providers on or off, set their limits, and enter write-only API keys.',
  failures: 'See AI runs that failed after their retries, and why.',
  abuse: 'Review reported resumes and misuse.',
  audit: 'Search and export the append-only audit log.',
  settings: 'Admin portal settings.',
  help: 'Runbooks for the on-call and support work the portal supports.',
};

/**
 * An admin page whose board isn't built yet: this slice builds the shell and the Overview, and each
 * area follows once the owner has reviewed it (`toreview.md` §171). An address no row claims is a
 * 404.
 */
export function AdminSectionScreen({ section }: { section: string }) {
  const item = adminItemBySegment(section);
  if (!item) notFound();

  return (
    <div className="px-8 pt-8">
      <ComingSoon
        title={item.label}
        section="V2 §7.17"
        description={WHAT[item.key] ?? 'This admin page is on its way.'}
        back={{ label: 'Back to Overview', href: '/admin' as Route }}
      />
    </div>
  );
}
