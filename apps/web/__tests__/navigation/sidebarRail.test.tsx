import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createQueryClient } from '@nextkin/shared/queries';

import { Sidebar } from '@/navigation/Sidebar';
import { SIDEBAR_STORAGE_KEY, sidebarBootScript } from '@/navigation/sidebarBoot';
import { NARROW_SIDEBAR_QUERY } from '@/navigation/useSidebarRail';
import { COLLAPSE_FADE, COLLAPSE_MOUNT, COLLAPSE_TRACK } from '@/ui/CollapseFade';
import { renderWithQuery } from '../../testSupport/render';

let mockPathname = '/jobs';
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));

const html = document.documentElement;
const runBootScript = () => new Function(sidebarBootScript)();

/** Answers one media query as given, every other as the jsdom stub does (no match). */
function matchMediaFor(query: string, matches: boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((q: string) => ({
    ...original(q),
    matches: q === query ? matches : false,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

afterEach(() => {
  html.removeAttribute('data-sidebar');
  localStorage.clear();
  mockPathname = '/jobs';
});

describe('sidebar boot script', () => {
  it('marks <html> collapsed before paint when the user keeps it collapsed', () => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'true');
    runBootScript();
    expect(html).toHaveAttribute('data-sidebar', 'collapsed');
  });

  it('leaves it alone when expanded, unset or unreadable', () => {
    for (const stored of ['false', null, '{not json']) {
      if (stored === null) localStorage.removeItem(SIDEBAR_STORAGE_KEY);
      else localStorage.setItem(SIDEBAR_STORAGE_KEY, stored);
      runBootScript();
      expect(html).not.toHaveAttribute('data-sidebar');
    }
  });
});

describe('CollapseFade classes', () => {
  /**
   * Tailwind finds class names by reading source text, so each one has to be written out whole
   * in the file; one built at runtime gets no CSS and the sidebar would snap.
   */
  it('writes every class it applies as a whole literal', () => {
    const source = readFileSync(join(__dirname, '../../src/ui/CollapseFade.tsx'), 'utf8');
    const classes = [
      ...Object.values(COLLAPSE_TRACK).flatMap((axis) => Object.values(axis)),
      ...Object.values(COLLAPSE_FADE),
      ...Object.values(COLLAPSE_MOUNT),
    ];
    for (const value of classes) expect(source).toContain(`'${value}'`);
  });
});

describe('Sidebar on a wide window', () => {
  it('keeps <html> in step with the toggle', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Sidebar />);

    const toggle = await screen.findByRole('button', { name: /(Collapse|Expand) navigation/ });
    if (toggle.getAttribute('aria-expanded') === 'false') await user.click(toggle);
    expect(html).not.toHaveAttribute('data-sidebar');

    await user.click(screen.getByRole('button', { name: 'Collapse navigation' }));
    expect(html).toHaveAttribute('data-sidebar', 'collapsed');
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Expand navigation' }));
    expect(html).not.toHaveAttribute('data-sidebar');
  });
});

describe('Sidebar on a narrow window', () => {
  let restore: () => void;
  beforeEach(() => {
    restore = matchMediaFor(NARROW_SIDEBAR_QUERY, true);
  });
  afterEach(() => restore());

  const shell = () => document.querySelector('[data-sidebar-shell]');

  it('starts on the rail and opens over the page without remembering it', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Sidebar />);

    await user.click(await screen.findByRole('button', { name: 'Expand navigation' }));

    expect(screen.getByRole('button', { name: 'Collapse navigation' })).toBeInTheDocument();
    expect(shell()).toHaveAttribute('data-overlay');
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBeNull();
    expect(html).not.toHaveAttribute('data-sidebar');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Sidebar />);

    await user.click(await screen.findByRole('button', { name: 'Expand navigation' }));
    await user.keyboard('{Escape}');

    expect(shell()).not.toHaveAttribute('data-overlay');
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument();
  });

  it('closes on a press outside it, and when the route changes', async () => {
    const user = userEvent.setup();
    // Rendered by hand, so the same query client survives the re-render a route change causes.
    const client = createQueryClient();
    const ui = () => (
      <QueryClientProvider client={client}>
        <Sidebar />
      </QueryClientProvider>
    );
    const view = render(ui());

    await user.click(await screen.findByRole('button', { name: 'Expand navigation' }));
    await user.click(document.body);
    expect(shell()).not.toHaveAttribute('data-overlay');

    await user.click(screen.getByRole('button', { name: 'Expand navigation' }));
    mockPathname = '/documents';
    act(() => view.rerender(ui()));
    expect(shell()).not.toHaveAttribute('data-overlay');
  });
});
