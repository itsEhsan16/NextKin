import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Sidebar } from '@/navigation/Sidebar';
import {
  NAV_FOOTER_ITEMS,
  NAV_ITEMS,
  activeIndex,
  isNavItemActive,
  resolveActivePath,
} from '@/navigation/navItems';
import { renderWithQuery } from '../../testSupport/render';

jest.mock('next/navigation', () => ({ usePathname: () => '/jobs' }));

describe('Sidebar', () => {
  it('renders every destination the board draws', async () => {
    renderWithQuery(<Sidebar />);

    for (const item of [...NAV_ITEMS, ...NAV_FOOTER_ITEMS]) {
      expect(await screen.findByRole('link', { name: new RegExp(item.label) })).toBeInTheDocument();
    }
    expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument();
    expect(screen.getByText('NextKin')).toBeInTheDocument();
  });

  it('leads to the Profile page from the user chip, and to Settings from its row', async () => {
    renderWithQuery(<Sidebar />);

    expect(await screen.findByRole('link', { name: /your profile/i })).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(screen.getByRole('link', { name: /Settings/ })).toHaveAttribute('href', '/settings');
  });

  it('marks the current destination, and only that one', async () => {
    renderWithQuery(<Sidebar />);

    const current = await screen.findAllByRole('link', { current: 'page' });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(/Jobs/);
  });

  it('draws the current row with one highlight per list', async () => {
    const { container } = renderWithQuery(<Sidebar />);
    await screen.findByRole('link', { current: 'page' });

    // Jobs is the main list's second row. Neither footer row is current, so that list's
    // highlight is faded out rather than sitting on Settings.
    const [main, footer] = container.querySelectorAll<HTMLElement>('[data-highlight]');
    expect(main).toHaveAttribute('data-visible', 'true');
    expect(main?.style.getPropertyValue('--slide-index')).toBe('1');
    expect(footer).toHaveAttribute('data-visible', 'false');
  });

  it('collapses to the rail and back', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Sidebar />);

    const toggle = await screen.findByRole('button', { name: 'Collapse navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);

    const expand = await screen.findByRole('button', { name: 'Expand navigation' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    // The rail keeps the destinations reachable — real label text, not a manual aria-label, so
    // this is the same accessible-name path the expanded panel uses.
    expect(await screen.findByRole('link', { name: /Interview Prep/ })).toBeInTheDocument();
  });

  /**
   * `UpgradeCard` and the header's bell button stay mounted in both states now (so their
   * appearance/disappearance can animate rather than pop), with `inert` taking the currently-off
   * one out of the accessibility tree. jsdom doesn't enforce `inert`'s actual focus-blocking
   * behaviour, so this pins the `tabIndex={-1}` each one sets itself — a guarantee independent of
   * `inert` support, and what a real keyboard-Tab pass (`toreview.md` §11) also needs to hold.
   */
  it("keeps only the current state's upgrade link in the tab order, and has no bell", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Sidebar />);

    const compactUpgrade = () => screen.getByRole('link', { name: 'Upgrade to Pro' });
    const expandedUpgrade = () => screen.getByRole('link', { name: 'Upgrade Now' });

    // `useSidebarCollapsed`'s cached state is module-scoped, not reset between tests, so an
    // earlier test's toggle click can leave this one starting collapsed — force a known starting
    // point rather than assume the default.
    const collapseToggle = await screen.findByRole('button', {
      name: /(Collapse|Expand) navigation/,
    });
    if (collapseToggle.getAttribute('aria-expanded') === 'false') {
      await user.click(collapseToggle);
    }

    // The sidebar's own bell is gone (redesign R4, SH-03): the top bar's is the one way in.
    expect(screen.queryByRole('button', { name: /Notifications/ })).toBeNull();

    // Expanded: the card's own CTA is reachable; the compact rail link is out of the way.
    expect(expandedUpgrade()).not.toHaveAttribute('tabindex', '-1');
    expect(compactUpgrade()).toHaveAttribute('tabindex', '-1');

    await user.click(await screen.findByRole('button', { name: 'Collapse navigation' }));

    // Collapsed: the rail's compact link takes over; the card's CTA drops out.
    expect(compactUpgrade()).not.toHaveAttribute('tabindex', '-1');
    expect(expandedUpgrade()).toHaveAttribute('tabindex', '-1');
  });
});

describe('isNavItemActive', () => {
  it('matches Home exactly but lets every other destination own its subtree', () => {
    expect(isNavItemActive('/', '/')).toBe(true);
    expect(isNavItemActive('/', '/jobs')).toBe(false);
    expect(isNavItemActive('/jobs', '/jobs')).toBe(true);
    expect(isNavItemActive('/jobs', '/jobs/abc')).toBe(true);
    // Guards the prefix trap: /interview must not light up for /interviews-archive.
    expect(isNavItemActive('/interview', '/interviews-archive')).toBe(false);
  });
});

describe('resolveActivePath', () => {
  it('lights a clicked row before its route loads, then hands over to the pathname', () => {
    expect(resolveActivePath('/jobs', null)).toBe('/jobs');
    expect(resolveActivePath('/jobs', { href: '/applications', from: '/jobs' })).toBe(
      '/applications',
    );
    // The pathname has moved on (the route landed, or Back went elsewhere): the click is stale.
    expect(resolveActivePath('/', { href: '/applications', from: '/jobs' })).toBe('/');
  });
});

describe('activeIndex', () => {
  it("finds the current row's place in a list, or -1 when the list has none", () => {
    expect(activeIndex(NAV_ITEMS, '/jobs/abc')).toBe(1);
    expect(activeIndex(NAV_ITEMS, '/profile')).toBe(-1);
    expect(activeIndex(NAV_FOOTER_ITEMS, '/settings')).toBe(0);
    expect(activeIndex(NAV_FOOTER_ITEMS, '/jobs')).toBe(-1);
  });
});
