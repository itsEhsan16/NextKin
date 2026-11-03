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
    // Upload New JD opens the JD upload page (247:2).
    expect(screen.getByRole('link', { name: 'Upload New JD' })).toHaveAttribute(
      'href',
      '/upload-jd',
    );
    expect(screen.getByRole('link', { name: /^Notifications/ })).toHaveAttribute(
      'href',
      '/notifications',
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
        'link',
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
    expect(screen.queryByRole('link', { name: 'Upload New JD' })).not.toBeInTheDocument();
  });

  it("draws no way back on the upload page, whose title sits in the bar's band", () => {
    onPage('/upload-jd');
    renderWithQuery(<TopBar />);

    expect(screen.queryByRole('link', { name: 'Back to Jobs' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upload New JD' })).toBeInTheDocument();
  });
});
