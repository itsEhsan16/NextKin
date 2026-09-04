import type { TextStyle } from 'react-native';

/** Font family names as registered by @expo-google-fonts/plus-jakarta-sans. */
export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  /** Brand wordmark only (Figma uses Inter Bold for the "NextKin" logotype). */
  brand: 'Inter_700Bold',
} as const;

export type FontWeightKey = keyof typeof fontFamily;

export type TypeRole = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'>;

/**
 * The Figma file draws every screen twice: the "Mobile App" page at 520 and the "Mobile 2" page
 * at 390. Measured node by node, the second is the first at exactly this factor — every box,
 * gap, radius, border, shadow offset, *leading* and *tracking*. Font size is the single
 * exception, which is what `role()` below exists to record.
 */
export const BOARD_RATIO = 390 / 520; // 0.75

/** A role's measurements on one artboard. */
export type TypeAnchor = { fontSize: number; lineHeight: number; letterSpacing: number };

/** The same role as drawn on each of the two artboards. */
export type TypeAnchors = {
  fontFamily: string;
  at520: TypeAnchor;
  at390: TypeAnchor;
  /**
   * This role is sized to fit a fixed-width cell rather than to be read at a chosen size, so
   * it tracks that cell all the way down instead of holding at the narrow board. See
   * `typographyFor`, and the Home tile rows at the bottom of this file.
   */
  cellBound?: true;
  /** Set when `at390` is the drawn measurement and `at520` is derived. See `boardRole`. */
  drawnAt390?: true;
};

/** As drawn on one artboard: [fontSize, lineHeight, letterSpacing?]. */
type Drawn = readonly [fontSize: number, lineHeight: number, letterSpacing?: number];

/**
 * One text role, measured on both artboards.
 *
 * The design team scaled the layout down by `BOARD_RATIO` and deliberately did *not* scale type
 * with it: the larger the role the closer it stayed to 0.75, the smaller the role the closer to
 * 1.0, and the tab label did not move at all. That bend is what keeps text legible at phone
 * width, and no single factor can express it — hence two anchors per role rather than one
 * number and a multiplier.
 *
 * `at390` is normally just the font size. Leading and tracking *did* scale by `BOARD_RATIO`, so
 * they are derived rather than retyped — one less digit to get wrong. The handful of Home tiles
 * that pin their leading pass the full triple instead.
 */
const role = (family: FontWeightKey, at520: Drawn, at390: number | Drawn): TypeAnchors => {
  const [fontSize, lineHeight, letterSpacing = 0] = at520;
  const drawn390: Drawn =
    typeof at390 === 'number'
      ? [at390, lineHeight * BOARD_RATIO, letterSpacing * BOARD_RATIO]
      : at390;
  const [fontSize390, lineHeight390, letterSpacing390 = letterSpacing * BOARD_RATIO] = drawn390;

  return {
    fontFamily: fontFamily[family],
    at520: { fontSize, lineHeight, letterSpacing },
    at390: { fontSize: fontSize390, lineHeight: lineHeight390, letterSpacing: letterSpacing390 },
  };
};

/**
 * A role whose size is decided by the box around it, not by how big it wants to be.
 *
 * The rule the rest of the ramp follows — hold at the 390 board below that width, so text stays
 * readable on a narrow phone — is exactly wrong for text living inside a fixed-height or
 * fixed-width box, because those boxes are artboard lengths and keep scaling under 390. Text that
 * stopped shrinking while its box did not would end up taller or wider than the thing drawn
 * around it: a count badge whose digit spills past its circle, a ring caption that meets its own
 * stroke, a tile label that wraps where it should not.
 *
 * So these carry their box down with them: the same slack at every width, and never a fit that
 * only held at 390. `__tests__/theme/typeRamp.test.ts` holds the arithmetic for each one.
 */
const cellRole = (family: FontWeightKey, at520: Drawn, at390: Drawn): TypeAnchors => ({
  ...role(family, at520, at390),
  cellBound: true,
});

/**
 * A role measured on Home Screen 210:262, which is drawn at 390 rather than projected down to it.
 *
 * Every other board in this file was authored at 520 and scaled by `BOARD_RATIO`, so `at520` is
 * the measurement and `at390` the design team's answer to it. The new Home board inverts that:
 * the 390 numbers are the drawn ones, and no 520 counterpart exists to measure. Deriving `at520`
 * as `at390 / BOARD_RATIO` puts the pair exactly on the geometry line, which is both the honest
 * reading — the same design, unprojected — and the reason these roles need no leading exemption.
 *
 * Their sizes are noticeably larger than the Mobile 2 roles they replace, because the board is:
 * 210:262 re-typed Home at 20pt headings and 17pt card titles where 115:2 had 14.5 and 15.
 */
const boardRole = (family: FontWeightKey, at390: Drawn): TypeAnchors => {
  const [fontSize, lineHeight, letterSpacing = 0] = at390;
  const up = (value: number): number => value / BOARD_RATIO;
  return {
    ...role(family, [up(fontSize), up(lineHeight), up(letterSpacing)], at390),
    drawnAt390: true,
  };
};

/** `boardRole`, for text the box decides the size of. See `cellRole`. */
const boardCellRole = (family: FontWeightKey, at390: Drawn): TypeAnchors => ({
  ...boardRole(family, at390),
  cellBound: true,
});

/**
 * Text roles mapped from Figma text styles (Plus Jakarta Sans).
 * Use `<Text variant="title">` rather than ad-hoc font sizes.
 *
 * Node ids read `<520 node> / <390 node>` where both were measured.
 */
export const typography = {
  /** Home hero ("Build better. Land faster.") — Figma 1:31 / 115:31. */
  hero: boardRole('bold', [32, 38]), // 210:288
  /** "NextKin" logotype — Figma 1:28 / 115:28. */
  wordmark: boardRole('brand', [38.038, 46.189]), // 210:270
  displayLg: role('bold', [28, 36, -0.4], 22), // hero numbers / greeting name
  screenTitle: role('bold', [28, 34], 22), // "Jobs" (Figma 1:264 / 118:3)
  display: role('bold', [22, 30, -0.3], 17.5), // screen titles, stat values
  headline: role('bold', [20, 28, -0.2], 16.5), // sheet / section titles
  greetingLabel: boardRole('regular', [13, 16]), // header "Hi" line (210:277)
  greeting: boardRole('medium', [15, 20]), // header user name (210:279)
  section: role('semiBold', [19, 28.5], 15.5), // card section titles on Jobs (1:40 / 115:40)
  /**
   * Every section heading on Home. 210:262 draws "Quick Start", "Top Job Matches" and "Your
   * Resume Progress" identically; the three roles this replaces existed only because the older
   * boards gave each a different weight.
   */
  homeSection: boardRole('bold', [20, 26]), // 210:298 / 210:349 / 210:413
  /** "Your Resume Progress" (1:157 / 115:157) — the board draws this one a step smaller. */
  cardTitle: boardRole('semiBold', [17, 22]), // company name on job cards (210:372)
  label: role('semiBold', [16, 24], 13.5), // list-row titles (Home has its own — see homeResumeTitle)
  title: role('semiBold', [17, 24], 14.5), // card titles, row labels
  titleSm: role('semiBold', [15, 22], 13), // salary, secondary titles
  body: role('regular', [15, 22], 13),
  bodyMedium: role('medium', [15, 22], 13),
  bodySemiBold: role('semiBold', [15, 22], 13),
  caption: role('medium', [13, 20], 11.5), // meta, subtitles
  captionRegular: role('regular', [13, 20], 11.5),
  jobMeta: role('medium', [13, 19.5], 11.5), // job card meta line (Figma 1:334)
  captionSemiBold: role('semiBold', [13, 20], 11.5), // selected segment, match pill
  segment: role('medium', [14, 20], 12.5), // segmented-control label
  segmentActive: role('semiBold', [14, 20], 12.5),
  groupLabel: role('semiBold', [14, 20], 12.5), // filter-sheet group headings (Figma 1:766)
  rowLabel: role('medium', [14, 21], 12.5), // match-criteria rows (Figma 1:857)
  prose: role('regular', [15, 25], 13), // long-form body copy (Figma 1:876)
  bulletBody: role('regular', [15, 23], 13), // responsibility bullets (Figma 1:878)
  captionSm: role('medium', [12, 18], 11.5), // slider scale ends (Figma 1:803)
  pill: role('regular', [12, 18], 11.5), // pick-card pills
  pillStrong: role('semiBold', [12, 18], 11.5),
  rowDescription: role('medium', [13, 19], 11.5), // sheet row descriptions (Figma 13/19)
  micro: role('medium', [11, 16.5], 10.5),
  microRegular: role('regular', [11, 16], 10.5),
  microSemiBold: role('semiBold', [12, 18], 11.5),
  microBadge: role('semiBold', [11, 16], 10.5), // doc-type pills on resume cards (Figma 1:1423)
  rowTitle: role('medium', [17, 24], 14.5), // grouped settings rows (Figma 1:2240)
  menuRow: role('medium', [16, 24], 13.5), // action-sheet rows (Figma 1:2036)
  headlineLg: role('bold', [24, 32], 19), // first-run title (Figma 1:2082 / 95:2283)
  pageTitle: role('bold', [26, 34], 20.5), // "Notification preferences" (1:2714 / 95:2915)
  displaySemiBold: role('semiBold', [22, 30], 17.5), // profile name (Figma 1:2201)
  overline: role('semiBold', [13, 20, 0.3], 11.5), // group labels "CAREER PROFILE" (1:2237)
  microOverline: role('bold', [10, 14, 0.6], 9.5), // "ATS SCORE" ring caption (1:2117 / 95:2318)
  scoreHero: role('bold', [42, 48], 31.5), // score-panel ring value (1:2116 / 95:2317)
  scoreSm: role('bold', [13, 20], 11.5), // mini ATS badge value (Figma 1:1418)
  tiny: role('regular', [10, 15], 9.5), // small sub-labels
  /**
   * "ATS Score" inside the Home progress ring (1:173 / 115:173). Box-bound, and sized to clear
   * the stroke rather than to match the board: 8pt is 38.4dp wide inside a 60dp ring, leaving
   * ~10.8dp a side against a 3dp stroke. The board’s own 6.56 is unreadable, and the shared
   * `tiny` at 9.5 runs right up to the ring.
   */
  ringCaption: cellRole('semiBold', [10.5, 14], [8, 10.5]),
  badge: role('bold', [10, 14, 0.2], 9.5), // "AI" badge (Figma 1:1264 / 95:2246)
  /**
   * Filter count badge (1:274) and the profile completeness badge. Box-bound: both sit in a
   * bordered circle whose size is an artboard length.
   *
   * The board draws this 11pt on a 22pt line, which is not leading — it is Figma centring one
   * glyph inside the badge. Carried over literally it made the line box exactly the badge
   * height, so the 1.5pt border pushed the digit straight out of the circle. React Native
   * centres with flexbox, so the leading can just be leading.
   */
  badgeCount: cellRole('bold', [11, 16], [10.5, 12]),
  /**
   * Bottom-nav label. Box-bound: it lives in a tab slot inside the pill, and both are artboard
   * lengths.
   *
   * Sized to the pill rather than off the board. Home Screen 215:490 places the whole nav at
   * 0.805 of its 520 size on a 390 frame, so the label lands at 7.28 there — smaller than the 9
   * the older boards give it, and far below what anyone reads on a phone. The bigger pill has
   * the room, and NAV_BOOST widened it again: 13.2 leaves ≈18% between “Resumes” and “Profile”,
   * which collide at 16.1.
   */
  tabLabel: cellRole('semiBold', [17.6, 22, 0.11], [13.2, 16.5, 0.0825]),
  statLg: role('bold', [22, 28, -0.3], 17.5),
  statRegular: role('regular', [20, 30], 16.5), // ATS ring value on Resumes (Home uses homeRingValue)
  stat: role('bold', [18, 24, -0.2], 15),
  logoInitial: role('bold', [18, 22], 15),

  // ---------------------------------------------------------------------------------------
  // Home-only roles, measured on Home Screen 210:262.
  //
  // Each is named for the node it was measured at, so the divergence from the shared ramp reads
  // as a measurement rather than a typo. Several exist only because the node they answer to is
  // drawn on Home at a size the shared role cannot take: `label`, `bodyMedium` and
  // `captionRegular` are between them used on twelve other screens still drawn on the older
  // boards, so Home gets its own role rather than dragging those with it.
  //
  // Listed as `DIVERGENT` in __tests__/theme/typeRamp.test.ts.
  // ---------------------------------------------------------------------------------------

  /** "Full-time" / "2d ago" chips on the Home job cards (1:118 / 115:118). */
  homeCardChip: boardRole('medium', [11, 14]), // 210:376
  /** "80+ applied" under the Home job cards (1:129 / 115:129) — a full 0.75. */
  homeCardMeta: boardRole('medium', [11, 14]), // 210:387
  /** "98%" in the Home match badge (1:111 / 115:111). */
  homeMatchValue: boardRole('bold', [13, 16]), // 210:369
  /** "Match" under it (1:113 / 115:113). */
  homeMatchLabel: boardRole('medium', [11, 14]), // 210:371
  /** "View all" section links (1:99 / 115:99) — a full 0.75. */
  viewAllLink: boardRole('semiBold', [13, 18]), // 210:417
  /** "Led UX Designer" under the company on a Home job card. Shared `bodyMedium` is 13. */
  /**
   * The four Home roles that live in a residual column.
   *
   * Each sits in a `flex: 1` gap between siblings pinned to artboard lengths — the resume card's
   * middle column between an s(80) thumbnail and an s(80) ring, the check labels beside their
   * s(11) glyphs, the pick card's role line inside an s(288) card. Those boxes keep shrinking
   * below 390 while a plain `boardRole` holds flat, so the board's own copy stopped fitting the
   * board's own layout: "UX Designer Resume" overran its column by 5.36dp at 360 and 23.51 at
   * 320, "Last updated 2 days ago" by 5.60 at 320, and the three validation checks wrapped
   * "JD Matched" onto a second line the artboard has no state for. Box-bound, they track their
   * columns down and the 390 and 520 anchors are untouched — the board is drawn exactly as
   * measured at both widths it was measured at.
   */
  homeCardRole: boardCellRole('medium', [14, 20]), // 210:373
  /** The resume name in Your Resume Progress. Shared `label` is 12.75. */
  homeResumeTitle: boardCellRole('semiBold', [17, 22]), // 210:427
  /** "Last updated 2 days ago" beneath it. Shared `captionRegular` is 9.75. */
  homeResumeMeta: boardCellRole('regular', [13, 18]), // 210:429
  /** The three validation checks under the meter — "Timeline valid" and friends. */
  homeCheckLabel: boardCellRole('medium', [12, 16]), // 210:445
  /** The score inside the ATS ring. Shared `statRegular` is 16.5 and overruns the stroke. */
  homeRingValue: boardRole('bold', [20, 24]), // 210:434

  // ---------------------------------------------------------------------------------------
  // Home tile rows — the two roles that answer to neither board.
  //
  // Both boards keep these labels on one line inside a fixed-width cell, which is a size trap:
  // the *whole string* has to fit, so "Interview Prep" alone caps its row at 9.21pt and Figma
  // ended up shrinking each string separately to make it work ("History" 9.2 against "Interview
  // Prep" 7.2, and "12 Resumes" larger than its own title "My Resumes"). No arrangement of that
  // is readable on a phone.
  //
  // Wrapping to two lines breaks the trap: only the longest *word* has to fit, so the label can
  // be sized to be read. These two are therefore drawn past both artboards, and the sub-labels
  // that used to sit under them are gone — the copy now reaches screen readers as a hint, and
  // the shortcut counters moved above their icons where they compete with nothing.
  //
  // Sizes are the longest word against the cell, at ~0.5dp per glyph per point (calibrated on
  // "History": 42dp at 12pt, seven glyphs). __tests__/theme/typeRamp.test.ts holds that budget.
  // ---------------------------------------------------------------------------------------

  /**
   * Quick Start, four across. Longest word "Resume" — 3.0dp/pt against a 66.6dp cell even on a
   * 320dp screen, so 14 clears it by a third and can hold flat on every phone.
   */
  tileLabel: boardRole('semiBold', [14, 14]), // 210:305 — leading is set to the size on the board
  /**
   * Shortcut grid, five across, so the cell is 64.5dp and the longest words are "Interview" and
   * "Assistant" at 4.5dp/pt. That leaves ~9% at 13 — but only while the type tracks the cell it
   * is measured against, which is why this one alone stays a `cellRole`.
   */
  shortcutLabel: boardCellRole('semiBold', [11, 14]), // 210:341
} as const satisfies Record<string, TypeAnchors>;

export type TypographyRole = keyof typeof typography;
