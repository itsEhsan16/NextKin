import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockStore, resetMockRepos } from '@nextkin/shared/repos';

import { NotificationsPanel } from '@/features/notifications/components/NotificationsPanel';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const now = Date.now();
const ago = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

const ROWS = [
  {
    id: 'n_app',
    category: 'applications' as const,
    body: '**Stripe** viewed your application',
    description: 'For Senior Product Designer.',
    createdAt: ago(0),
    read: false,
    deepLink: '/applications/app_1',
    visual: { kind: 'logo' as const, company: 'Stripe' },
  },
  {
    id: 'n_ai',
    category: 'ai' as const,
    body: 'Your ATS score is ready',
    description: 'Two quick wins left.',
    createdAt: ago(3),
    read: true,
    visual: { kind: 'glyph' as const, icon: 'bolt', tone: 'success' as const },
  },
];

function Panel({ onOpenChange = jest.fn() }: { onOpenChange?: (open: boolean) => void }) {
  return <NotificationsPanel open onOpenChange={onOpenChange} />;
}

/** The notification window from the bell (owner, 2026-11-14). */
describe('NotificationsPanel', () => {
  beforeEach(() => {
    resetMockRepos();
    push.mockClear();
    mockStore.state.notifications = ROWS.map((r) => ({ ...r }));
  });

  it('groups the feed by day, filters by kind, and says how many are new', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Panel />);
    const panel = screen.getByRole('dialog', { name: 'Notifications' });
    await within(panel).findByText('1 new', {}, { timeout: SETTLE_MS.normal });
    expect(within(panel).getByRole('region', { name: 'Today' })).toBeInTheDocument();
    expect(within(panel).getByRole('region', { name: 'This week' })).toBeInTheDocument();

    const show = within(panel).getByRole('group', { name: 'Show' });
    // Only the kinds the feed holds.
    expect(within(show).queryByRole('button', { name: 'Billing' })).toBeNull();
    await user.click(within(show).getByRole('button', { name: 'AI results' }));
    expect(within(panel).getByText('Your ATS score is ready')).toBeInTheDocument();
    expect(within(panel).queryByText('viewed your application')).toBeNull();

    await user.click(within(show).getByRole('button', { name: /^Unread/ }));
    expect(within(panel).getByText('viewed your application')).toBeInTheDocument();
    expect(within(panel).queryByText('Your ATS score is ready')).toBeNull();
  });

  it('opens a row where it points, marks it read and closes', async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();
    renderWithQuery(<Panel onOpenChange={onOpenChange} />);
    await user.click(
      await screen.findByRole(
        'button',
        { name: 'Stripe viewed your application, unread' },
        { timeout: SETTLE_MS.normal },
      ),
    );
    expect(push).toHaveBeenCalledWith('/applications?application=app_1');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(mockStore.state.notifications[0]!.read).toBe(true));
  });

  it('marks all read, then says everything is caught up under Unread', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Panel />);
    const panel = screen.getByRole('dialog', { name: 'Notifications' });
    await user.click(
      await within(panel).findByRole(
        'button',
        { name: 'Mark all read' },
        { timeout: SETTLE_MS.normal },
      ),
    );
    await user.click(within(panel).getByRole('button', { name: 'Unread' }));
    expect(await within(panel).findByText('You’re all caught up')).toBeInTheDocument();
  });

  it('removes a row', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Panel />);
    await user.click(
      await screen.findByRole(
        'button',
        { name: 'Remove: Your ATS score is ready' },
        { timeout: SETTLE_MS.normal },
      ),
    );
    await waitFor(() => expect(screen.queryByText('Your ATS score is ready')).toBeNull());
  });
});
