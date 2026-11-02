import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockStore, resetMockRepos } from '@nextkin/shared/repos';

import { NotificationsScreen } from '@/features/notifications/screens/NotificationsScreen';
import { webHrefOf } from '@/features/notifications/webHref';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const ROW = {
  id: 'n_1',
  category: 'applications' as const,
  body: '**Any news from Stripe?**',
  description: 'You applied for Designer 7 days ago.',
  createdAt: new Date().toISOString(),
  read: false,
  deepLink: '/applications/app_1',
  visual: { kind: 'logo' as const, company: 'Stripe' },
};

describe('the web notification feed (toreview §148.1)', () => {
  beforeEach(() => {
    resetMockRepos();
    push.mockClear();
  });

  it('opens a row where it points, and marks it read', async () => {
    mockStore.state.notifications = [ROW];
    const user = userEvent.setup();
    renderWithQuery(<NotificationsScreen />);
    const row = await screen.findByRole(
      'button',
      { name: 'Any news from Stripe?, unread' },
      { timeout: SETTLE_MS.normal },
    );
    await user.click(row);
    expect(push).toHaveBeenCalledWith('/applications?application=app_1');
    await waitFor(() => expect(mockStore.state.notifications[0]?.read).toBe(true), {
      timeout: SETTLE_MS.normal,
    });
  });

  it('marks everything read, and removes a row', async () => {
    mockStore.state.notifications = [ROW, { ...ROW, id: 'n_2', body: 'Second' }];
    const user = userEvent.setup();
    renderWithQuery(<NotificationsScreen />);
    await user.click(
      await screen.findByRole('button', { name: 'Mark all read' }, { timeout: SETTLE_MS.normal }),
    );
    await waitFor(() => expect(mockStore.state.notifications.every((n) => n.read)).toBe(true), {
      timeout: SETTLE_MS.normal,
    });
    await user.click(screen.getByRole('button', { name: 'Remove: Second' }));
    await waitFor(() => expect(mockStore.state.notifications).toHaveLength(1), {
      timeout: SETTLE_MS.normal,
    });
  });

  it('says so when there is nothing yet', async () => {
    mockStore.state.notifications = [];
    renderWithQuery(<NotificationsScreen />);
    expect(
      await screen.findByText('Nothing yet', {}, { timeout: SETTLE_MS.normal }),
    ).toBeInTheDocument();
  });

  it('offers a retry when it can’t load', async () => {
    renderWithQuery(<NotificationsScreen />, 'error');
    expect(
      await screen.findByText("Couldn't load your notifications", {}, { timeout: SETTLE_MS.error }),
    ).toBeInTheDocument();
  });

  it('maps the phone’s links to web pages, and never to one that doesn’t exist', () => {
    expect(webHrefOf('/applications/a%201')).toBe('/applications?application=a%201');
    expect(webHrefOf('/generations/g1')).toBe('/resumes');
    expect(webHrefOf('/jobs/j1')).toBe('/jobs/j1');
    expect(webHrefOf('/jobs')).toBe('/jobs');
    expect(webHrefOf('/upgrade')).toBe('/upgrade');
    expect(webHrefOf('/profile/questions')).toBeNull();
    expect(webHrefOf(undefined)).toBeNull();
  });
});
