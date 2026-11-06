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
  /**
   * Set when neither anchor was drawn: the role comes from a board at some third width and both
   * anchors are projected from it, so the pair sits on the flat geometry line. See `authRole`.
   */
  singleBoard?: true;
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
  // -------------------------------------------------------------------------------------------
  // The shared reading roles, re-anchored on the newer Mobile 2 boards (toreview.md 54).
  //
  // These were measured on the 520 boards and bent down to 13pt body / 11.5pt captions at 390.
  // The boards drawn since — Home 210:262, the redrawn job cards 498:2 / 519:2, the score panel
  // 95:2310 — set body at 14–15, meta at 13 and row titles at 16, so a screen still on the old
  // anchors read a size smaller than the screen beside it. The owner chose to bring every screen
  // up to the newer boards. Only type values moved: no box, gap or component changed with them.
  // -------------------------------------------------------------------------------------------
  section: boardRole('semiBold', [16, 22]), // in-page section titles — "Content" (95:2324)
  confirmTitle: boardRole('bold', [18, 23]), // "Sign out?" on every confirm sheet (573:828)
  /**
   * Every section heading on Home. 210:262 draws "Quick Start", "Top Job Matches" and "Your
   * Resume Progress" identically; the three roles this replaces existed only because the older
   * boards gave each a different weight.
   */
  homeSection: boardRole('bold', [20, 26]), // 210:298 / 210:349 / 210:413
  /** "Your Resume Progress" (1:157 / 115:157) — the board draws this one a step smaller. */
  cardTitle: boardRole('semiBold', [17, 22]), // company name on job cards (210:372)
  // The redrawn Jobs cards (498:2 / 519:2). They put the company name where the title used to be
  // and the title on its own line below, so neither lands on a role the older boards drew.
  jobListTitle: boardRole('semiBold', [16, 21]), // 498:13
  jobListCompany: boardRole('semiBold', [13, 16.5]), // 498:7
  /** The carousel card is a size down from the list card, and names its company a weight lighter. */
  pickCardTitle: boardRole('semiBold', [15.5, 20]), // 519:16
  pickCardCompany: boardRole('medium', [13, 17]), // 519:7
  pickCardSalary: boardRole('semiBold', [14, 18]), // 519:17
  /** The " · est." the carousel card sets a weight lighter beside the figure. */
  pickCardSalaryEst: boardRole('regular', [14, 18]), // 519:17
  /** Job Detail's salary, redrawn a step down from `display` and semibold (Figma 443:14). */
  jobDetailSalary: boardRole('semiBold', [16.5, 21]), // 443:14
  // Row and card titles at the redrawn job card's 16 (498:13); list rows and sheet rows a step under.
  title: boardRole('semiBold', [16, 21]), // card titles, row labels
  rowTitle: boardRole('medium', [16, 21]), // grouped settings rows (Figma 1:2240)
  label: boardRole('semiBold', [15, 20]), // list-row titles (Home has its own — see homeResumeTitle)
  menuRow: boardRole('medium', [15, 20]), // action-sheet rows (Figma 1:2036)
  titleSm: boardRole('semiBold', [14, 19]), // salary, secondary titles
  // Body at the score summary's 14 (95:2321); long-form copy at the checklist's 15 (95:2329).
  body: boardRole('regular', [14, 20]),
  bodyMedium: boardRole('medium', [14, 20]),
  bodySemiBold: boardRole('semiBold', [14, 20]),
  prose: boardRole('regular', [15, 22]), // long-form body copy (Figma 1:876)
  bulletBody: boardRole('regular', [15, 21]), // responsibility bullets (Figma 1:878)
  // Controls and form-group labels.
  segment: boardRole('medium', [14, 19]), // segmented-control label
  segmentActive: boardRole('semiBold', [14, 19]),
  groupLabel: boardRole('semiBold', [14, 19]), // filter-sheet group headings (Figma 1:766)
  rowLabel: boardRole('medium', [14, 19]), // match-criteria rows (Figma 1:857)
  // Meta and captions at the job cards' and score panel's 13 (498:7 / 519:7 / 95:2322).
  caption: boardRole('medium', [13, 18]), // meta, subtitles
  captionRegular: boardRole('regular', [13, 18]),
  jobMeta: boardRole('medium', [13, 18]), // job card meta line (Figma 1:334)
  captionSemiBold: boardRole('semiBold', [13, 18]), // selected segment, match pill
  captionSm: boardRole('medium', [13, 18]), // slider scale ends (Figma 1:803)
  pill: boardRole('regular', [13, 18]), // pick-card pills
  pillStrong: boardRole('semiBold', [13, 18]),
  rowDescription: boardRole('medium', [13, 18]), // sheet row descriptions
  microSemiBold: boardRole('semiBold', [13, 18]),
  // The smallest free-standing text: 12, the floor the Mobile 2 audit set (toreview.md 38.3).
  micro: boardRole('medium', [12, 16]),
  microRegular: boardRole('regular', [12, 16]),
  microBadge: boardRole('semiBold', [12, 16]), // doc-type pills on resume cards (Figma 1:1423)
  headlineLg: role('bold', [24, 32], 19), // first-run title (Figma 1:2082 / 95:2283)
  pageTitle: role('bold', [26, 34], 20.5), // "Notification preferences" (1:2714 / 95:2915)
  displaySemiBold: role('semiBold', [22, 30], 17.5), // profile name (Figma 1:2201)
  overline: boardRole('semiBold', [12.5, 17, 0.3]), // group labels "CAREER PROFILE" (1:2237)
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
   * Bottom-nav label, as the bar draws it (Figma 429:7586): 7.256 / 10.883 on a 299 pill, times
   * NAV_BOOST (1.1) like the rest of the bar — 7.98 / 11.97 at 390. Box-bound: it lives in a tab
   * slot inside the pill, so it tracks the pill all the way down.
   */
  tabLabel: cellRole('semiBold', [7.98 / 0.75, 11.97 / 0.75], [7.98, 11.97]),
  statLg: role('bold', [22, 28, -0.3], 17.5),
  statRegular: role('regular', [20, 30], 16.5), // ATS ring value on Resumes (Home uses homeRingValue)
  stat: role('bold', [18, 24, -0.2], 15),
  logoInitial: role('bold', [18, 22], 15),
  companyInitial: boardRole('bold', [29, 34]), // the company page's 68 mark (JOBS 09 580:1657)

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
  homeCardChip: boardRole('medium', [13, 17]), // 210:376 draws 11; meta is 13 app-wide (toreview.md 54)
  /** "80+ applied" under the Home job cards (1:129 / 115:129). */
  homeCardMeta: boardRole('medium', [13, 17]), // 210:387 draws 11; as above
  /** "98%" in the Home match badge (1:111 / 115:111). */
  homeMatchValue: boardRole('bold', [13, 16]), // 210:369
  /** "Match" under it (1:113 / 115:113). */
  homeMatchLabel: boardRole('medium', [13, 17]), // 210:371 draws 11; as above
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

  // RESUMES 04 — score panel, enlarged on the 390 board (95:2310, toreview.md 38.19 / 47).
  scoreTitle: boardRole('semiBold', [16.5, 22]), // 95:2313
  scoreRingLabel: boardRole('bold', [10.5, 13, 0.45]), // "ATS SCORE" (95:2318)
  scoreSummary: boardRole('medium', [14, 20]), // 95:2321
  scoreContext: boardRole('medium', [13, 17]), // 95:2322
  scoreSection: boardRole('semiBold', [16, 22]), // "Content" (95:2324)
  scoreCount: boardRole('medium', [13.5, 18]), // "4 of 5" (95:2325)
  scoreCheck: boardRole('medium', [15, 20]), // checklist rows (95:2329)
  scoreFix: boardRole('semiBold', [13.5, 18]), // "Fix" pill (95:2339)
  scoreRecalc: boardRole('medium', [13, 18]), // 95:2382
  scoreCta: boardRole('semiBold', [13.5, 16.5]), // "Fix 4 quick wins" (95:2388)

  // NOTIF 01 redesign (619:2). The description and time reuse captionRegular and micro, which the
  // board draws at the same 13 / 12.
  notifTitle: boardRole('bold', [14.5, 19.5]), // 619:46

  // The profile editors' company/school letter tiles (PROFILE 04 573:43, PROFILE 05 573:154).
  entryInitial: boardRole('bold', [17, 20]),
  entryInitialLg: boardRole('bold', [20, 24]),
  tileCode: boardRole('bold', [12.5, 16]), // "EN" on the language sheet's tiles (577:1850)
  tailorRingValue: boardRole('bold', [27, 31]), // "72" in the compare hero's ring (607:32)
  editorRingValue: boardRole('bold', [21, 24]), // "92" in the editor hero's ring (577:6966)
  notifTitleRun: boardRole('medium', [14.5, 19.5]), // 619:81 — the medium half of a mixed headline
  notifInitial: boardRole('bold', [19, 22.8]), // 619:54 — the letter in a company tile
  notifStackInitial: boardCellRole('bold', [12, 14.4]), // 619:24 — 26pt digest tiles
  notifStackMore: boardCellRole('semiBold', [11, 14]), // 619:32 — "+2"

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

  // ---------------------------------------------------------------------------------------
  // The 2026-11 redesign ramp (toreview.md §172). A short, semantic set that every redesigned
  // screen uses instead of the per-board roles above: big confident titles, one reading size,
  // one meta size. Measured at 390 like the newer boards. Legacy roles stay until their screens
  // are redesigned, then go.
  // ---------------------------------------------------------------------------------------
  largeTitle: boardRole('bold', [30, 36, -0.6]),
  title1: boardRole('bold', [24, 30, -0.4]),
  title2: boardRole('bold', [20, 26, -0.2]),
  title3: boardRole('semiBold', [17, 22, -0.1]),
  bodyLg: boardRole('regular', [15, 22]),
  bodyLgStrong: boardRole('semiBold', [15, 22]),
  callout: boardRole('regular', [14, 20]),
  footnote: boardRole('medium', [13, 18]),
  buttonLabel: boardRole('semiBold', [16, 20]),
  eyebrow: boardRole('semiBold', [12, 16, 0.6]),
  numberLg: boardRole('bold', [28, 32, -0.5]),
} as const satisfies Record<string, TypeAnchors>;

export type TypographyRole = keyof typeof typography;
