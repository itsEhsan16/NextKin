/**
 * The column every page sits in (`toreview.md` §16): the full width beside the sidebar up to
 * 1440. The layout's `TopBar` sits in the same column, so its buttons end where a page's content
 * does. Gutters step 16 / 24 / 32 with the window, so a phone-width window never scrolls sideways
 * (redesign R4, audit SH-01).
 */
export const pageColumn = 'mx-auto w-full max-w-container-page px-4 sm:px-6 lg:px-8';

/**
 * A page's frame: the column, starting 24px under the top bar's band, which puts every title 32px
 * under the bar's buttons (`toreview.md` §28). One constant, so the pages cannot drift apart.
 */
export const pageFrame = `${pageColumn} pt-8`;

/**
 * The top bar's band: 20px above its 36px controls and 8px under them. It stays pinned while a
 * page scrolls under it, so the room a page has is the window less this 4rem.
 */
export const topBarHeight = 'h-16';

/** Exactly the window under the top bar: the list pages, whose one list is what scrolls. */
export const pageFill = 'h-page-fill';

/** At least the window under the top bar: error and coming-soon states, centred in it. */
export const pageFillMin = 'min-h-page-fill';

/** Where a column held in view sticks: 20px under the top bar's band, clear of its buttons. */
export const stickyBelowTopBar = 'top-below-topbar';

/** The same, from 1024 up (where a rail column sticks). A literal, so Tailwind finds it. */
export const stickyBelowTopBarLg = 'lg:top-below-topbar';

/**
 * A page that starts inside the top bar's band, its title level with the bar's controls: every
 * built page but Settings, as the owner moved them up (2026-10-09, `toreview.md` §87). `TopBar`'s
 * `BY_PATH` lists them. The bar draws no background on such a page (`TopBar`'s `inBar`) until the
 * page scrolls under it.
 *
 * From 1280 only (redesign R4, audit SH-02): below that the bar's controls take the band's width,
 * and the title ran under the search ("Find the right oppor…" at 1024), so it sits under the bar
 * like any other page.
 */
export const pageFrameInBar = `${pageColumn} pt-8 xl:-mt-16 xl:pt-6`;

/** The whole window, for a list page that starts inside the top bar's band (from 1280). */
export const pageFillInBar = 'h-page-fill xl:h-dvh';
