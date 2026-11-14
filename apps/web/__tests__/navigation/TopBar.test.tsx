import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname } from 'next/navigation';

import { signOut } from '@/lib/signOut';
import { TopBar } from '@/navigation/TopBar';
import { renderWithQuery, SETTLE_MS } from '../../testSupport/render';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
  useRouter: () => ({ push }),
}));
jest.mock('@/lib/signOut', () => ({ signOut: jest.fn(() => Promise.resolve()) }));

const onPage = (path: string) => jest.mocked(usePathname).mockReturnValue(path);

describe('TopBar', () => {
  it('holds the app-wide actions', () => {
    onPage('/');
    renderWithQuery(<TopBar />);

    expect(
      screen.getByRole('searchbox', { name: 'Search jobs, skills, companies' }),
    ).toBeInTheDocument();
    // Build Resume opens the job step of the one resume flow (toreview §203).
    expect(screen.getByRole('link', { name: 'Build Resume' })).toHaveAttribute(
      'href',
      '/create/build',
    );
    // The bell opens the notification panel (owner, 2026-11-14), not the page.
    expect(screen.getByRole('button', { name: /^Notifications/ })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
    expect(screen.getByRole('button', { name: 'Your account' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Back to Jobs' })).not.toBeInTheDocument();
  });

  it('opens the account menu from the avatar: who is signed in, Profile, Settings, Sign out (§164)', async () => {
    const user = userEvent.setup();
    onPage('/');
    renderWithQuery(<TopBar />);

    await user.click(screen.getByRole('button', { name: 'Your account' }));
    expect(await screen.findByRole('menuitem', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Profile' }));
    expect(push).toHaveBeenCalledWith('/profile');

    await user.click(screen.getByRole('button', { name: 'Your account' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("shows the user's photo, and says so when there are unread notifications", async () => {
    onPage('/');
    const { container } = renderWithQuery(<TopBar />);

    expect(
      await screen.findByRole(
        'button',
        { name: 'Notifications, unread' },
        { timeout: SETTLE_MS.normal },
      ),
    ).toBeInTheDocument();
    await waitFor(
      () => expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/george.png'),
      { timeout: SETTLE_MS.normal },
    );
  });

  it("names Documents' action as its board does, and leaves it inert", () => {
    onPage('/documents');
    renderWithQuery(<TopBar />);

    // 286:2026 draws "Upload New Document"; nothing is behind it yet.
    expect(screen.getByRole('button', { name: 'Upload New Document' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Build Resume' })).not.toBeInTheDocument();
  });

  // Redesign R4 (audit SH-04): the ⌘K hint promised a search that went nowhere.
  it('searches jobs on Enter, and ⌘K / Ctrl+K jumps to the field', async () => {
    const user = userEvent.setup();
    onPage('/');
    push.mockClear();
    renderWithQuery(<TopBar />);
    const field = screen.getByRole('searchbox', { name: 'Search jobs, skills, companies' });

    await user.keyboard('{Control>}k{/Control}');
    expect(field).toHaveFocus();

    await user.type(field, 'product designer{Enter}');
    expect(push).toHaveBeenCalledWith('/jobs?q=product%20designer');
  });

  it('opens the sidebar from its menu button, where there is no rail', async () => {
    const user = userEvent.setup();
    onPage('/');
    const opened = jest.fn();
    window.addEventListener('nextkin:open-sidebar', opened);
    renderWithQuery(<TopBar />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(opened).toHaveBeenCalledTimes(1);
    window.removeEventListener('nextkin:open-sidebar', opened);
  });
});
