import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';

import HomeFilled from '../../assets/icons/nav/home-filled.svg';
import HomeOutline from '../../assets/icons/nav/home-outline.svg';
import JobsFilled from '../../assets/icons/nav/jobs-filled.svg';
import JobsOutline from '../../assets/icons/nav/jobs-outline.svg';
import ResumesFilled from '../../assets/icons/nav/resumes-filled.svg';
import ResumesOutline from '../../assets/icons/nav/resumes-outline.svg';

import type { TabName } from './tabScroll';

/** The typed hrefs for the four tab routes. */
export type TabHref = '/(tabs)' | '/(tabs)/jobs' | '/(tabs)/resumes';

/**
 * Every number here is read off Home Screen 215:490 and divided by 0.75, because that board is
 * 390 wide and `sizes`/`s()` are 520 space.
 *
 * `Icon`/`IconActive` are the outline and filled cuts of the same glyph. The four state boards
 * (220:522 / 553 / 584 / 615) differ in exactly one thing: the selected tab's icon is the filled
 * variant and the other three are outlines.
 *
 * The redrawn bar (429:7518) adds the colour those boards did not have: the selected tab is drawn
 * in the brand violet, icon and label alike, and the other three in grey. So the cross-fade now
 * carries a tint as well as a cut — each cut is painted in its own state's colour, and fading
 * between them is also what fades between the two colours. The label fades the same way, between
 * two stacked copies (toreview.md §83.1, which reverses §39.3).
 *
 * `w`/`h` are the icon boxes — each glyph has its own aspect ratio, so they are not square. Both
 * cuts of a glyph share an aspect ratio, so one box serves both and the icon cannot jump as it
 * crosses over.
 * `centre` is where the board puts the tab, as a fraction of the pill width: the four are NOT
 * evenly spaced, and equal flex puts Resumes ~6pt left of where it is drawn. `slot` is the
 * tab’s own width, also a fraction of the pill — sized to its label plus a little padding, so
 * no two touch targets overlap and none of them clips its own text.
 */
export type TabMeta = {
  name: TabName;
  label: string;
  href: TabHref;
  Icon: FC<SvgProps>;
  IconActive: FC<SvgProps>;
  w: number;
  h: number;
  centre: number;
  slot: number;
};

/**
 * The tab icons over the bar's own scale. The owner found them too small at the board's size
 * (2026-10-02), so they are 30% larger than the pill alone would make them. Width and height move
 * together, so each glyph keeps its aspect.
 */
export const ICON_BOOST = 1.3;

/** Presentation + destination per tab, in the order they sit in the pill. */
export const TABS: readonly TabMeta[] = [
  // Icons 215:492 / 215:496 / 215:504 / 215:510; centres and slots against the 299.9475 pill.
  {
    name: 'index',
    label: 'Home',
    href: '/(tabs)',
    Icon: HomeOutline,
    IconActive: HomeFilled,
    w: 21.9966,
    h: 25.6318,
    centre: 0.1126,
    slot: 0.132,
  },
  {
    name: 'jobs',
    label: 'Jobs',
    href: '/(tabs)/jobs',
    Icon: JobsOutline,
    IconActive: JobsFilled,
    w: 24.2619,
    h: 23.3852,
    centre: 0.2952,
    slot: 0.107,
  },
  {
    name: 'resumes',
    label: 'Resumes',
    href: '/(tabs)/resumes',
    Icon: ResumesOutline,
    IconActive: ResumesFilled,
    w: 22.6444,
    h: 20.0806,
    centre: 0.6972,
    slot: 0.19,
  },
];

/**
 * Router segment → tab. `index` is deliberately absent: inside the group its segments are just
 * `['(tabs)']`, so "no tab segment matched" *is* the Home tab.
 */
const TAB_BY_SEGMENT: Record<string, TabName> = {
  jobs: 'jobs',
  resumes: 'resumes',
};

/**
 * Floor for icon shrinkage, as a fraction of the designed size — glyphs stay legible on narrow
 * screens. Applied to width and height alike so the aspect ratio survives the clamp.
 */

export function activeTabFor(segments: readonly string[]): TabName {
  for (const segment of segments) {
    const tab = TAB_BY_SEGMENT[segment];
    if (tab) return tab;
  }
  return 'index';
}
