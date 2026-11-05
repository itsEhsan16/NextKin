import { screen, within } from '@testing-library/react';

import { ADMIN_ROLE_PERMISSIONS, type AdminPermission } from '@nextkin/shared/models';
import { resetMockRepos } from '@nextkin/shared/repos';

import { navFor } from '@/features/admin/shell/adminNav';
import { AdminSidebar } from '@/features/admin/shell/AdminSidebar';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

jest.mock('next/navigation', () => ({ usePathname: () => '/admin' }));

const wait = { timeout: SETTLE_MS.normal * 3 };
const labels = (permissions: readonly AdminPermission[]) =>
  navFor(permissions).flatMap((group) => group.items.map((item) => item.label));

describe('AdminSidebar (Figma 401:1432)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('draws every group for a Super Admin, with the queue counts', async () => {
    renderWithQuery(<AdminSidebar />);

    const nav = screen.getByRole('navigation', { name: 'Admin' });
    const overview = await within(nav).findByRole('link', { name: 'Overview' }, wait);
    expect(overview).toHaveAttribute('aria-current', 'page');
    for (const group of ['People', 'Content', 'Business', 'Trust & safety']) {
      expect(within(nav).getByRole('heading', { name: group })).toBeInTheDocument();
    }
    expect(
      await within(nav).findByRole('link', { name: /Technology KB.*14 open/ }, wait),
    ).toHaveAttribute('href', '/admin/technologies');
    expect(within(nav).getByText('Super Admin')).toBeInTheDocument();
  });

  it('shows a Curator no People and no Audit log', () => {
    const curator = labels(ADMIN_ROLE_PERMISSIONS.curator);
    expect(curator).not.toContain('Users');
    expect(curator).not.toContain('Staff & roles');
    expect(curator).not.toContain('Audit log');
    expect(curator).toContain('Technology KB');
    expect(navFor(ADMIN_ROLE_PERMISSIONS.curator).map((group) => group.label)).not.toContain(
      'People',
    );
  });

  it('shows Support people and the audit log, but not content or billing', () => {
    const support = labels(ADMIN_ROLE_PERMISSIONS.support);
    expect(support).toEqual(expect.arrayContaining(['Users', 'Audit log', 'Analytics']));
    expect(support).not.toContain('AI prompts');
    expect(support).not.toContain('Plans & pricing');
  });
});
