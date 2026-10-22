import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname } from 'next/navigation';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

import { useMockModeStore } from '@nextkin/shared/mock';
import { createQueryClient } from '@nextkin/shared/queries';

import { Sidebar } from '@/navigation/Sidebar';

jest.mock('next/navigation', () => ({ usePathname: jest.fn(() => '/jobs') }));

/**
 * `next/link` needs the App Router to navigate, and jsdom has none. This keeps the one behaviour
 * the sidebar builds on: a plain click on an in-app link calls `onNavigate`, before the new route
 * (and so `usePathname`) has changed.
 */
jest.mock('next/link', () => ({
  __esModule: true,
  default: function MockLink({
    onNavigate,
    children,
    ...anchor
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { onNavigate?: () => void }) {
    return (
      <a
        {...anchor}
        onClick={(event) => {
          event.preventDefault();
          onNavigate?.();
        }}
      >
        {children}
      </a>
    );
  },
}));

const onPage = (path: string) => jest.mocked(usePathname).mockReturnValue(path);
const current = () => screen.getByRole('link', { current: 'page' });

/** `renderWithQuery`, but through `wrapper`, so `rerender` keeps the provider. */
function renderSidebar() {
  useMockModeStore.setState({ mode: 'normal' });
  const client = createQueryClient();
  function Providers({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<Sidebar />, { wrapper: Providers });
}

describe('Sidebar navigation', () => {
  beforeEach(() => {
    onPage('/jobs');
  });

  it('moves the highlight to a clicked row straight away, before the route loads', async () => {
    const user = userEvent.setup();
    const { container } = renderSidebar();

    await user.click(await screen.findByRole('link', { name: /Applications/ }));

    // `usePathname` still says /jobs: the click alone moved it.
    expect(current()).toHaveAccessibleName(/Applications/);
    const highlight = container.querySelector<HTMLElement>('[data-highlight]');
    expect(highlight?.style.getPropertyValue('--slide-index')).toBe('2');
  });

  it('hands over to the pathname when the route lands, and forgets the click after Back', async () => {
    const user = userEvent.setup();
    const { rerender } = renderSidebar();

    await user.click(await screen.findByRole('link', { name: /Applications/ }));

    onPage('/applications');
    rerender(<Sidebar />);
    expect(current()).toHaveAccessibleName(/Applications/);

    // Back to the page the click left from: the stale click must not light Applications again.
    onPage('/jobs');
    rerender(<Sidebar />);
    expect(current()).toHaveAccessibleName(/Jobs/);
  });
});
