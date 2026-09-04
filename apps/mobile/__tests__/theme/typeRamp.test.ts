import { themeFor, typography, type TypographyRole } from '@/theme';

import { textWidth } from '../../testSupport/fontMetrics';

/**
 * A transcription guard for the 390 column of `typography.ts`.
 *
 * Roughly fifty roles were hand-read off the Figma "Mobile 2" page, one node at a time. A single
 * fat-fingered digit in that column is invisible on review and produces a screen that is subtly
 * wrong rather than obviously broken — so this pins the *shape* of the curve the design team
 * drew, which no individual typo can satisfy.
 *
 * Least squares over the sixteen distinct measured sizes gives a straight line to within half a
 * pixel: the smaller the role, the less of the 0.75 layout shrink it took. This does not
 * generate any value — every number in `typography.ts` is measured — it only refuses ones that
 * could not have come off that board.
 */
const SLOPE = 0.685;
const INTERCEPT = 2.77;
const TOLERANCE = 0.6;

const predicted = (at520: number) => SLOPE * at520 + INTERCEPT;

/**
 * The curve above describes the *Mobile 2* compression, so it can only judge a role measured on
 * a 520 board and projected down. Roles carrying `drawnAt390` were drawn at 390 on Home Screen
 * 210:262 and have their 520 anchor derived from it, which puts them on the flat 0.75 geometry
 * line instead — a different claim, checked separately below rather than exempted one by one.
 */
const BOARD_RATIO = 390 / 520;

/**
 * Roles the Mobile 2 board genuinely draws off the shared curve, each measured at the node named
 * in `typography.ts`. Listing them makes each one a decision on the record; without the list
 * they would either fail this test or, worse, be averaged away into the ramp.
 */
const OFF_CURVE: readonly TypographyRole[] = [
  // Sized to clear the ring stroke rather than to be read at a chosen size. The board's own
  // 6.56 is unreadable; the shared small roles run into the ring.
  'ringCaption',
  // Sized to the nav pill. 215:490 places the whole bar at 0.805 of its 520 size, which puts
  // the label at 7.28 on a 390 frame — below even the 9 the older boards give it.
  'tabLabel',
];

const roles = Object.entries(typography) as [TypographyRole, (typeof typography)[TypographyRole]][];
const drawn390 = roles.filter(([, role]) => role.drawnAt390);
const projected = roles.filter(([, role]) => !role.drawnAt390);
const onCurve = projected.filter(([name]) => !OFF_CURVE.includes(name));
const offCurve = projected.filter(([name]) => OFF_CURVE.includes(name));

describe('the Mobile 2 type ramp', () => {
  it('measured enough roles to be worth checking', () => {
    expect(onCurve.length).toBeGreaterThan(25);
  });

  it.each(drawn390)('role "%s" carries the 390 that Home Screen 210:262 draws', (_name, role) => {
    // These invert the rest of the file: the 390 number is the measurement and the 520 one is
    // derived, so the only thing to check is that the pair never drifted off the geometry line.
    // Nothing here is a judgement call, which is why they need no exemption list.
    expect(role.at520.fontSize).toBeCloseTo(role.at390.fontSize / BOARD_RATIO, 9);
    expect(role.at520.lineHeight).toBeCloseTo(role.at390.lineHeight / BOARD_RATIO, 9);
  });

  it('re-measured the Home screen rather than a role here and there', () => {
    // 210:262 re-typed Home wholesale — 20pt headings against Mobile 2's 14.5, 17pt card titles
    // against 15. If this list ever shrinks back to a handful, someone has reverted the screen
    // to the old board piecemeal, which is how it came to look wrong in the first place.
    expect(drawn390.length).toBeGreaterThanOrEqual(18);
    expect(drawn390.every(([name]) => !OFF_CURVE.includes(name))).toBe(true);
  });

  it.each(onCurve)('role "%s" sits on the curve the 390 board draws', (_name, role) => {
    expect(Math.abs(role.at390.fontSize - predicted(role.at520.fontSize))).toBeLessThanOrEqual(
      TOLERANCE,
    );
  });

  it.each(offCurve)('role "%s" is off the curve on purpose, not by accident', (_name, role) => {
    // Keeps the exemption list honest: an entry that has come back onto the curve — because the
    // board changed, or because someone "fixed" the value — should be deleted, not left to rot.
    expect(Math.abs(role.at390.fontSize - predicted(role.at520.fontSize))).toBeGreaterThan(
      TOLERANCE,
    );
  });

  it('never draws a role larger at 390 than the 520 board draws it', () => {
    for (const [, role] of roles) {
      expect(role.at390.fontSize).toBeLessThanOrEqual(role.at520.fontSize);
    }
  });

  it('floors the smallest chrome at 9pt', () => {
    // Nothing on the shared ramp may land below what a phone can render legibly. The roles that
    // do sit lower are all box-bound, listed above, and checked against their own box instead.
    const readable = roles.filter(([, role]) => !role.cellBound);
    for (const [, role] of readable) expect(role.at390.fontSize).toBeGreaterThanOrEqual(9);
  });

  it('gives the nav label the room the bigger pill bought', () => {
    // The whole reason the pill grew. 13.2 against “Resumes” and “Profile”, which collide at 16.1.
    expect(typography.tabLabel.at390.fontSize).toBe(13.2);
  });
});

/**
 * What has to fit inside a Home tile.
 *
 * The labels wrap to two lines, so the constraint is not the whole string any more — it is the
 * longest *word*, which is the whole reason they can be read at all. A word that does not fit
 * breaks mid-word or spills, and neither degrades gracefully in a fixed-width cell, so the size
 * and the cell have to stay in agreement.
 *
 * `cell` is the artboard's container width at 390, and the width scales with it. `perPoint` is
 * dp of width per point of font size: ~0.5 per glyph, calibrated on the one single-word label the
 * board measures directly — "History", 42dp at 12pt over seven glyphs.
 */
const GLYPH = 0.5;

const WORD_BUDGET: readonly {
  role: TypographyRole;
  widest: string;
  cell: number;
  perPoint: number;
}[] = [
  // Quick Start, four across. "Resume" is the longest word in "Build/Zero Resume".
  { role: 'tileLabel', widest: 'Resume', cell: 81.19, perPoint: 6 * GLYPH },
  // Shortcuts, five across — the tightest row in the app.
  { role: 'shortcutLabel', widest: 'Interview', cell: 64.5, perPoint: 9 * GLYPH },
  // Not a tile, but the same trap: the Home progress ring. The cell is the ring box the caption
  // is centred in (80 on the 520 board), and it is box-bound, so the ~36% clearance it leaves
  // against a 3dp stroke holds at every width rather than closing as the ring shrinks.
  { role: 'ringCaption', widest: 'ATS Score', cell: 60, perPoint: 48 / 10 },
  // Bottom nav. The cell is the Resumes tab’s slot — 0.19 of the 299.9475 pill from 215:490 —
  // and per-point comes off that board’s own label box: 32dp at 7.279.
  { role: 'tabLabel', widest: 'Resumes', cell: 0.19 * 299.9475 * 1.1, perPoint: 32 / 7.279 },
];

describe('Home tile rows fit their cells', () => {
  it.each(WORD_BUDGET)('"$widest" fits its cell at every phone width', ({ role, cell, perPoint }) => {
    // The narrowest is the binding case for a clamped role, since its cell keeps shrinking while
    // the type holds. A cell-bound role keeps the same slack at all three.
    for (const width of [320, 360, 390]) {
      const drawn = (themeFor('light', width).typography[role].fontSize ?? 0) * perPoint;
      expect(drawn).toBeLessThan((cell * Math.min(width, 390)) / 390);
    }
  });

  it('keeps the tile labels worth reading', () => {
    // The point of wrapping them. Mobile 2 put these below 10pt, which is the size the whole
    // exercise was meant to escape, so the app overrode it. 210:262 then settled the question
    // itself at 14 and 11 — above that override rather than under it, so these are the board
    // agreeing with us. Hold the floor; the board's numbers now clear it on their own.
    expect(typography.tileLabel.at390.fontSize).toBeGreaterThanOrEqual(11);
    expect(typography.shortcutLabel.at390.fontSize).toBeGreaterThanOrEqual(11);
  });

  it('marks exactly the cell-bound roles as cell-bound', () => {
    // A role that stopped shrinking at 390 while its box carried on would overflow it. Four do:
    // the five-across tile label, the ring caption, the count badge and the nav label. Everything
    // else holds flat and is checked at 320, where a clamped role is closest to the box round it.
    const flagged = roles.filter(([, r]) => r.cellBound).map(([name]) => name).sort();
    expect(flagged).toEqual([
      'badgeCount',
      'homeCardRole',
      'homeCheckLabel',
      'homeResumeMeta',
      'homeResumeTitle',
      'ringCaption',
      'shortcutLabel',
      'tabLabel',
    ]);
  });
});

/**
 * What has to fit inside a box with a pinned height.
 *
 * This is the arithmetic that broke on a real phone. Box heights are artboard lengths, so they
 * keep scaling below 390; type holds there so it stays readable. Put readable type inside a
 * pinned box and the two drift apart — the filter badge shipped with its line box already equal
 * to the badge height at 390, so the 1.5pt border pushed the digit clean out of the circle, and
 * a 360dp screen made it 4pt worse. Nobody sees that by eye; the numbers say it immediately.
 *
 * Heights and borders below are 520-space, the same as the tokens they come from.
 */
const BOX_FIT: readonly {
  what: string;
  height: number;
  role: TypographyRole;
  /** Border or padding eating into the box, per edge. */
  inset: number;
}[] = [
  { what: 'filter count badge', height: 22, role: 'badgeCount', inset: 2 },
  { what: 'profile completeness badge', height: 22, role: 'badgeCount', inset: 2 },
  { what: 'segmented control', height: 48, role: 'segment', inset: 0 },
  { what: 'segmented active pill', height: 40, role: 'segmentActive', inset: 0 },
  { what: 'notifications group header', height: 40, role: 'overline', inset: 0 },
];

describe('text fits the box drawn around it', () => {
  it.each(BOX_FIT)('$what holds its line at every phone width', ({ height, role, inset }) => {
    for (const width of [320, 360, 390, 430]) {
      const theme = themeFor('light', width);
      const box = height * theme.scale;
      const line = theme.typography[role].lineHeight ?? 0;
      expect(line + inset * theme.scale * 2).toBeLessThanOrEqual(box);
    }
  });

  it('stacks the number and caption inside the Home ATS ring', () => {
    // Two lines and a stroke on each side, inside the 80pt ring from the board.
    for (const width of [320, 360, 390, 430]) {
      const theme = themeFor('light', width);
      const stacked =
        (theme.typography.homeRingValue.lineHeight ?? 0) +
        (theme.typography.ringCaption.lineHeight ?? 0);
      expect(stacked + theme.s(4) * 2).toBeLessThanOrEqual(80 * theme.scale);
    }
  });
});

/**
 * What has to fit *across* a box with a pinned width.
 *
 * `BOX_FIT` above covers the vertical half, and only because a line height is a number the ramp
 * already carries. Width had no such number. Whether "100%" fits a 44-unit badge depends on how
 * wide Plus Jakarta Sans draws a zero, and nothing in this repo knew that — so the half went
 * unchecked, and the profile completeness badge shipped sized for the "72%" the artboard drew
 * while `profileRepo.completeNextStep` walks completeness to a capped 1 in two taps. "100%" is one
 * glyph more than the board ever showed, and it overran the pill at 390 and every width below it.
 *
 * `testSupport/fontMetrics` reads the advances straight out of the shipped TTFs, so these are
 * drawn widths rather than estimates. Every row names the worst string the *data model* can
 * produce, which is the part an artboard cannot tell you: a board draws one value.
 */
describe('text fits across the box drawn around it', () => {
  const WIDTHS = [320, 360, 390, 411, 430, 520] as const;

  /** Inner width of a `boxWidth`-wide (520-space) box with `inset` per edge, at `width` dp. */
  const innerWidth = (width: number, boxWidth: number, inset: number) => {
    const theme = themeFor('light', width);
    return theme.s(boxWidth) - 2 * inset * theme.scale;
  };

  it('fits every percentage the profile completeness badge can reach', () => {
    // Not a sampled worst case: `completeness` is a 0–1 fraction, so the badge has exactly 101
    // reachable labels and this walks all of them. The width rule mirrors ProfileIdentity's own —
    // the board's 44 for the three-character values it drew, the derived 53.28 for "100%".
    for (const width of WIDTHS) {
      const theme = themeFor('light', width);
      for (let percent = 0; percent <= 100; percent++) {
        const label = `${percent}%`;
        const box = innerWidth(width, label.length > 3 ? 53.28 : 44, 2);
        expect(textWidth(theme.typography.badgeCount, label)).toBeLessThan(box);
      }
    }
  });

  it('gives "100%" the padding the board gives "72%"', () => {
    // 53.28 is derived rather than picked, and this is the derivation. Below 390 a cell-bound
    // role tracks its box, so matching the margin at the board matches it at every width under it.
    for (const width of [320, 360, 390]) {
      const theme = themeFor('light', width);
      const drawn = innerWidth(width, 44, 2) - textWidth(theme.typography.badgeCount, '72%');
      const widened = innerWidth(width, 53.28, 2) - textWidth(theme.typography.badgeCount, '100%');
      expect(widened).toBeCloseTo(drawn, 1);
    }
  });

  it('would have caught the badge that shipped', () => {
    // State the wrong answer outright, so the test says what it defends against and not only what
    // it wants. The board's own 44 holds every value the board drew and fails on the one it did not.
    const theme = themeFor('light', 390);
    const drawn = innerWidth(390, 44, 2);
    expect(textWidth(theme.typography.badgeCount, '72%')).toBeLessThan(drawn);
    expect(textWidth(theme.typography.badgeCount, '100%')).toBeGreaterThan(drawn);
  });
});

/**
 * What has to fit the column its pinned siblings leave behind.
 *
 * `STRING_FIT` above measures boxes with a width of their own. These have none: they are the
 * `flex: 1` residual after siblings pinned to artboard lengths take theirs, so the column shrinks
 * on the 520 factor while a plain role holds flat at its 390 anchor below that width. The two
 * drift, and the board's own copy stopped fitting the board's own layout — "UX Designer Resume"
 * overran its column by 5.36dp at 360 and 23.51dp at 320, and the three validation checks wrapped
 * "JD Matched" onto a second line no artboard draws. Every role below is `boardCellRole` for that
 * reason; this is the arithmetic that says so.
 *
 * Strings are the ones the fixtures actually ship. Longer runtime values — a generated resume
 * title, "40 minutes ago" — do not fit at any width including 520, so they are a copy question
 * rather than a scale one and are deliberately not asserted here.
 */
describe('text fits the column its pinned siblings leave behind', () => {
  const WIDTHS = [320, 360, 390, 411, 430, 520] as const;
  type Theme = ReturnType<typeof themeFor>;

  /** Inside the screen gutter, the Card's border, and ResumeProgressCard's own padding. */
  const resumeCardInner = (theme: Theme, width: number) =>
    Math.min(width, 520) - 2 * theme.spacing.gutter - 2 * theme.s(1) - 2 * theme.s(21);

  /** What is left of that after the s(80) thumbnail, the s(80) ring and the two gaps. */
  const resumeColumn = (theme: Theme, width: number) =>
    resumeCardInner(theme, width) - 2 * theme.s(80) - 2 * theme.spacing[4];

  it.each([
    ['the resume title', 'homeResumeTitle' as const, 'UX Designer Resume'],
    ['the freshness line', 'homeResumeMeta' as const, 'Last updated 2 days ago'],
  ])('%s holds its column at every phone width', (_what, role, drawn) => {
    for (const width of WIDTHS) {
      const theme = themeFor('light', width);
      expect(textWidth(theme.typography[role], drawn)).toBeLessThan(resumeColumn(theme, width));
    }
  });

  it('keeps the three validation checks on one line', () => {
    // The card wraps (`styles.checks` is flexWrap), so an overflow here is not a clipped glyph
    // but a second row of checks — a state the artboard has no drawing for, which grows the card.
    const CHECKS = ['Timeline Valid', 'ATS Optimized', 'JD Matched'];
    for (const width of WIDTHS) {
      const theme = themeFor('light', width);
      const row = CHECKS.reduce(
        (total, label) =>
          total + theme.s(11) + theme.s(4) + textWidth(theme.typography.homeCheckLabel, label),
        2 * theme.spacing[4],
      );
      expect(row).toBeLessThan(resumeCardInner(theme, width));
    }
  });

  it('holds the longest role a Top Job Matches card can show', () => {
    // The carousel card is pinned at s(288), so this column never gets the screen's extra width.
    for (const width of WIDTHS) {
      const theme = themeFor('light', width);
      const inner = theme.s(288) - 2 * theme.s(1) - 2 * theme.spacing[4];
      expect(textWidth(theme.typography.homeCardRole, 'Senior Product Designer')).toBeLessThan(inner);
    }
  });
});
