import { screen, waitFor } from '@testing-library/react';
import { usePathname } from 'next/navigation';

import { TopBar } from '@/navigation/TopBar';
import { renderWithQuery, SETTLE_MS } from '../../testSupport/render';

jest.mock('next/navigation', () => ({ usePathname: jest.fn(() => '/') }));

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
    expect(screen.getByRole('button', { name: /^Notifications/ })).toBeInTheDocument();
    // The avatar is the way into the Account page (307:3443).
    expect(screen.getByRole('link', { name: 'Your profile' })).toHaveAttribute('href', '/profile');
    expect(screen.queryByRole('link', { name: 'Back to Jobs' })).not.toBeInTheDocument();
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
    expect(screen.queryByRole('link', { name: 'Upload New JD' })).not.toBeInTheDocument();
  });

  it("draws no way back on the upload page, whose title sits in the bar's band", () => {
    onPage('/upload-jd');
    renderWithQuery(<TopBar />);

    expect(screen.queryByRole('link', { name: 'Back to Jobs' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upload New JD' })).toBeInTheDocument();
  });
});
