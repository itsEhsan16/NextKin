import { Platform } from 'react-native';

import { palette } from './palette';

export type ColorScheme = 'light' | 'dark';

/** Semantic colour roles. Keys are stable across schemes; only values change. */
export const colorsByScheme = {
  light: {
    // Text
    textPrimary: palette.ink900,
    textBody: palette.ink700,
    textSecondary: palette.ink520,
    textTertiary: palette.ink480,
    textBlack: palette.black,
    textOnDark: palette.offWhite,
    textOnBrand: palette.white,

    // Surfaces
    surfacePage: palette.white,
    surfaceCard: palette.white,
    surfaceSubtle: palette.gray150,
    surfaceSheet: palette.white,
    surfaceInverse: palette.ink900,
    surfaceBlack: palette.black,
    /** Selected filter chip / count badge fill. */
    surfaceSelected: palette.ink900,

    // Borders
    borderDefault: palette.gray200,
    borderHairline: palette.gray100,
    divider: palette.gray100,
    grabHandle: palette.gray200,
    /** Dashed "+ New" affordances (Figma 1:1394 draws #d1d5db dashes on near-white). */
    borderDashed: palette.gray300,

    /** Fill of the dashed "+ New" tile — a step quieter than surfaceSubtle. */
    surfaceFaint: palette.gray50,
    /** The library's "+ New" tile and row (Figma 95:1555 / 95:1797). */
    surfaceNewDoc: palette.brand30,
    /** Ghost document pages behind the first-run illustration (Figma 1:2065). */
    surfaceGhost: palette.gray100,

    // Icons
    iconDefault: palette.ink500,
    iconMuted: palette.ink450,
    iconChevron: palette.ink300,

    // Brand
    brand: palette.brand500,
    brandSurface: palette.brand50,
    brandBorder: palette.brand200,
    /** Unread notification rows: the "3% indigo tint" (Figma note 1:2497). */
    surfaceUnread: palette.brand25,
    /** Unread notification card border (Figma 619:44). */
    unreadBorder: palette.brand75,
    /** A read notification card's border — a step softer than borderDefault (Figma 619:89). */
    borderSoft: palette.gray120,
    // Notification tile tints and their glyphs (Figma 619:43 / 619:65 / 619:78 / 619:98 /
    // 619:111). Glyphs are decorative and sit beside a text headline, so they keep the board's
    // colours rather than the AA-darkened text ones.
    tileBrand: palette.brand60,
    /** Link-kind tiles on the profile boards (Figma 577:9046). */
    tileBrandStrong: palette.brand100,
    tileSuccess: palette.green60,
    glyphSuccess: palette.green600,
    tileWarm: palette.orange50,
    glyphWarm: palette.orange500,
    tileInfo: palette.blue50,
    glyphInfo: palette.blue600,
    tileDanger: palette.red60,
    glyphDanger: palette.red600,
    companyStripe: palette.stripe,
    companySlack: palette.slack,
    /** A decorative glyph on a lavender note — the cover letter's lightbulb (Figma 644:145). */
    glyphNote: palette.brand300,
    /** The dashed edge of a lavender "add" tile — ATS 01's paste tile (Figma 645:37). */
    borderBrandDashed: palette.brand250,
    /** Hairline inside the match-reason panel on a job card (Figma 498:24). */
    matchReasonRule: palette.brand150,
    /** Inline text links ("View all"): brand indigo since §178, not a second blue. */
    link: palette.brand600,

    // Status
    success: palette.green650,
    successSurface: palette.green50,
    successRing: palette.green400,
    successIcon: palette.green500,
    progressTrack: palette.gray200,
    progressFill: palette.blue500,
    danger: palette.red620,
    /** The outlined Delete button on the profile editors (Figma 573:285). */
    dangerBorder: palette.red200,
    dangerDot: palette.red500,
    dangerSurface: palette.red50,
    warning: palette.amber600,
    warningSurface: palette.amber50,
    /** "Good match" pill text (Figma 1:352) — darker than  for contrast on the tint. */
    warningStrong: palette.amber700,
    /** Amber meters: the resume-usage fill and mid-band ATS arcs (Figma 1:1393 / 1:1470). */
    warningAccent: palette.amber500,
    /** Hairline round an amber panel: amber500 at 35% (BILLING 01 reason banner, 577:9177). */
    warningBorder: 'rgba(245, 158, 11, 0.35)',

    // Chrome
    tabBarBackground: palette.white,
    /**
     * The redrawn nav (Figma 429:7518) tints the selected tab brand and the rest grey, where
     * every earlier board drew all four in the same ink. Icon and label share each colour.
     */
    tabActive: palette.brand500,
    /** Unselected tabs are black, not the board's grey — the owner's call (2026-10-02). */
    tabInactive: palette.black,
    avatarStack1: palette.gray300,
    avatarStack2: palette.ink400,
    avatarStack3: palette.ink500,
    fabFill: palette.brand600,
    fabGlyph: palette.offWhite,
    /**
     * The bottom bar's selected tab and AI button (§193): a light violet into the brand into a deep
     * indigo, the reference's cyan-to-navy in our own colours. The glow under the bar is the brand.
     */
    navGradientStart: '#8B7DFF',
    navGradientMid: palette.brand500,
    navGradientEnd: '#2A18C9',
    navGlow: palette.brand500,
    /** Unselected tabs: the deep ink of the page's titles, not black (§193). */
    navInactive: palette.ink950,
    scrim: 'rgba(10, 10, 10, 0.5)',
    /** Ink for shadows drawn inside an SVG, where a View shadow cannot follow the shape. */
    shadowInk: palette.black,
    skeletonBase: palette.skeleton,
    /** The diagonal band's light: white, faded in and out along its width (§196). */
    skeletonHighlight: palette.white,

    // Onboarding & auth (Figma 307:4152)
    onboardingGradientFrom: palette.brandGradient1,
    onboardingGradientMid: palette.brandGradient2,
    onboardingGradientTo: palette.brandGradient3,
    onboardingInk: palette.ink950,
    onboardingBody: palette.slate450,
    onboardingStepMuted: palette.gray220,
    dotActive: palette.ink950,
    dotInactive: palette.gray350,
    authAccent: palette.brand600,
    authFieldBorder: palette.gray250,
    ctaPrimary: palette.violet400,
    ctaPrimaryLabel: palette.ink950,
    jobCardBar: palette.gray300,

    // 2026-11 redesign (toreview.md §172)
    /** Near-black ink for primary pills and big titles. */
    ink: palette.ink950,
    /** The soft lavender the hero wash fades from. */
    surfaceWash: palette.brandGradient1,
    /** The page behind white cards on redesigned screens. */
    surfaceCanvas: palette.offWhite,
  },
  // Dormant: the app is light only (owner, 2026-10-25) and `useTheme()` never resolves 'dark'.
  // These values were never drawn and need a design before Dark is offered. For one thing,
  // `surfaceInverse` is white while `textOnDark` stays off-white, so those pairs vanish.
  dark: {
    textPrimary: '#F5F6F8',
    textBody: '#C9CDD6',
    textSecondary: '#9AA1AE',
    // Lightened (hue kept) to 4.5:1 on the dark card and unread surfaces; #6B7280 was 3.78:1.
    textTertiary: '#79818F',
    textBlack: '#FFFFFF',
    textOnDark: palette.offWhite,
    textOnBrand: palette.white,

    surfacePage: palette.dark900,
    surfaceCard: palette.dark800,
    surfaceSubtle: palette.dark700,
    surfaceSheet: palette.dark800,
    surfaceInverse: palette.white,
    surfaceBlack: palette.white,
    surfaceSelected: palette.white,

    borderDefault: palette.dark600,
    borderHairline: palette.dark700,
    divider: palette.dark700,
    grabHandle: palette.dark500,
    borderDashed: palette.dark500,

    surfaceFaint: palette.dark800,
    surfaceNewDoc: palette.dark800,
    surfaceGhost: palette.dark700,

    iconDefault: '#9AA1AE',
    iconMuted: '#6B7280',
    iconChevron: '#4B5563',

    brand: '#7C6CFF',
    brandSurface: '#1E1B3A',
    brandBorder: '#2F2A5C',
    surfaceUnread: '#17152E',
    unreadBorder: '#2A2654',
    borderSoft: palette.dark700,
    tileBrand: '#221E45',
    tileBrandStrong: '#29245A',
    tileSuccess: '#0F2A1A',
    glyphSuccess: '#4ADE80',
    tileWarm: '#2E1D10',
    glyphWarm: '#FB923C',
    tileInfo: '#15213A',
    glyphInfo: '#60A5FA',
    tileDanger: '#2A1414',
    glyphDanger: '#F87171',
    companyStripe: palette.stripe,
    companySlack: palette.slack,
    glyphNote: palette.brand300,
    borderBrandDashed: '#463F8A',
    matchReasonRule: palette.dark600,
    link: '#60A5FA',

    success: '#4ADE80',
    successSurface: '#0F2A1A',
    successRing: '#4ADE80',
    successIcon: '#4ADE80',
    progressTrack: palette.dark600,
    progressFill: '#60A5FA',
    danger: '#F87171',
    dangerBorder: '#5B2323',
    dangerDot: palette.red500,
    dangerSurface: '#2A1414',
    warning: '#FBBF24',
    warningSurface: '#2A2110',
    warningStrong: '#FBBF24',
    warningAccent: '#FBBF24',
    warningBorder: 'rgba(251, 191, 36, 0.35)',

    tabBarBackground: palette.dark800,
    // Dark has no board. brand500 is too deep to read on dark800, so the selected tab takes the
    // lighter brand step the auth flow already uses for the same reason.
    tabActive: '#9B8CFF',
    tabInactive: '#9AA1AE',
    avatarStack1: palette.dark500,
    avatarStack2: '#6B7280',
    avatarStack3: '#9AA1AE',
    fabFill: palette.brand500,
    fabGlyph: palette.white,
    navGradientStart: '#9B8CFF',
    navGradientMid: palette.brand500,
    navGradientEnd: '#2A18C9',
    navGlow: palette.brand500,
    navInactive: '#9AA1AE',
    scrim: 'rgba(0, 0, 0, 0.6)',
    shadowInk: palette.black,
    skeletonBase: palette.dark700,
    skeletonHighlight: palette.dark600,

    // Onboarding & auth (Figma 307:4152). The gradient is a brand surface, so it is identical in
    // both schemes; everything painted on top of neutral ground follows the dark palette. The
    // artboards are drawn light-only — see toreview.md.
    onboardingGradientFrom: palette.brandGradient1,
    onboardingGradientMid: palette.brandGradient2,
    onboardingGradientTo: palette.brandGradient3,
    onboardingInk: '#F5F6F8',
    onboardingBody: '#9AA1AE',
    onboardingStepMuted: palette.dark500,
    dotActive: '#F5F6F8',
    dotInactive: palette.dark500,
    authAccent: '#9B8CFF',
    authFieldBorder: palette.dark600,
    ctaPrimary: palette.violet400,
    ctaPrimaryLabel: palette.ink950,
    jobCardBar: palette.dark500,
    ink: '#F5F6F8',
    surfaceWash: palette.dark800,
    surfaceCanvas: palette.dark900,
  },
} as const satisfies Record<ColorScheme, Record<string, string>>;

export type Colors = { [K in keyof (typeof colorsByScheme)['light']]: string };
export type ColorToken = keyof Colors;

/** 4-pt spacing scale. Screen gutter is `spacing.gutter` (24). */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  gutter: 24,
  /** Safe area → title row on the tab screens (Home, Jobs, Resumes, Profile). */
  headerTop: 16,
  /** Safe area → back-button row on pushed screens (`ScreenHeader`) and the notifications feed. */
  headerTopPushed: 8,
} as const;

export const radii = {
  none: 0,
  xs: 8, // resume thumbnail
  sm: 9, // meta chip
  md: 12, // 40px logo tile, segmented active pill
  lg: 14, // 44/48px logo tile
  xl: 16, // inputs, buttons, 52px icon tiles
  xxl: 18, // 64px logo tile
  card: 20,
  cardLg: 24,
  sheet: 28,
  emptyTile: 28,
  full: 9999,
} as const;

/**
 * The bottom nav over the size the board draws it (429:7586): a deliberate 10% on the pill, the
 * FAB and the icons together, so the bar keeps the board's proportions. Set to 1 once on
 * 2026-10-02 and the owner found the bar too small, so it is back at 1.1 (toreview.md 51.4).
 */
export const NAV_BOOST = 1.1;

export const sizes = {
  // Home Screen 215:490 draws the pill 61.633 tall on its 390 frame; 520-space is /0.75, then
  // NAV_BOOST on top — see its definition below.
  tabBarHeight: 82.178 * NAV_BOOST,
  tabBarBottomOffset: 17,
  fab: 66.655 * NAV_BOOST,
  fabOverhang: 18.262 * NAV_BOOST,
  iconButton: 48,
  filterButton: 52,
  buttonMd: 52,
  buttonLg: 56,
  listRow: 58,
  grabHandleWidth: 44,
  grabHandleHeight: 5,
  minHitTarget: 44,
  avatarHeader: 56,
  completenessRing: 104,
  emptyStateTile: 96,
  sheetStep1Height: 600,
  /** CREATE 02 (95:1472): 416 tall on the 390 board, which grew it past the 520 page. */
  sheetStep2Height: 416 / 0.75,
  /** Filters sheet (Figma JOBS 04, 1:760) — scrolls internally, so this is a fixed height. */
  sheetFiltersHeight: 830,
  /** Resume card menu (Figma RESUMES 03, 1:2020). */
  sheetResumeMenuHeight: 600,
  /** Notification row menu (NOTIF 03, 1:2696) and the push primer (NOTIF 07, 1:2928). */
  sheetNotifHeight: 440,
  /** Floor for picker/confirm sheets — they hug their option list past this. */
  sheetPickerHeight: 320,
  /** Floor for the multiline TextField (Phase 9A forms) — it grows past this, never under it. */
  textArea: 140,
  /** Month/year picker sheet (Phase 9A) — a fixed grid of months, so a fixed height. */
  sheetMonthYearHeight: 520,
  /** Export format sheet — RESUMES 11 (580:1606) draws it 339.5 tall at 390. */
  sheetExportHeight: 339.5 / 0.75,
  /** Home hamburger menu sheet (Phase 9I). */
  sheetMenuHeight: 600,
  /** Jobs chrome (Figma JOBS 01). */
  searchField: 52,
  segmentedControl: 48,
  segmentedPill: 40,
  filterBadge: 22,
  /**
   * Tab title row (title + bell) to the row below it — search on Jobs and Resumes, the identity
   * block on Profile — so the tabs cannot drift apart. The bell, not the title, sets the row's
   * height, so the gap is measured from the bell's foot: RESUMES 01 draws 57 → 80 at 390
   * (95:1529 → 95:1532), JOBS 01 57 → 78 (118:4 → 118:7), PROFILE 01 24. Resumes' 23 is the one
   * kept (toreview.md 52.1 / 53).
   */
  titleRowGap: 23 / 0.75,
  /**
   * The pinned header's last row to the first scrolling block: search → type pills on Resumes
   * (95:1532 ends at 119, 95:1539 starts at 144 — 25 at 390), search → location chips on Jobs
   * (22.75 on 118:2). One value for both, Resumes' (toreview.md 54).
   */
  headerContentGap: 33,
  unreadDot: 8,
  /**
   * Line-icon boxes (`ui/Icon`), on the web's ramp: 12 / 16 / 20 / 24 at 390, so a phone draws
   * the same icon at the same size as `apps/web`'s `iconSize`. The glyph sits inside the box
   * with Untitled UI's own padding. `sm` beside text and in row trailers, `md` standing alone
   * (header and close buttons), `lg` for a lead tile, `xs` inside chips and pills.
   */
  iconXs: 12 / 0.75,
  iconSm: 16 / 0.75,
  iconMd: 20 / 0.75,
  iconLg: 24 / 0.75,
  /** Figma's 1px stroke, and the 2px rings (avatar stack, score ring, filter button). */
  border: 1,
  borderThick: 2,
  /** Width of the artboards in the Figma file; see useLayoutScale(). */
  designWidth: 520,
} as const;

export type ShadowStyle = {
  boxShadow?: string;
  elevation?: number;
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
};

/**
 * A shadow as drawn in Figma. Offsets and blur are design px; alpha and elevation are not.
 *
 * `rgb` is an `"r, g, b"` triple, for the rare shadow a board does not draw in black — the
 * redrawn FAB casts the brand violet rather than a grey (Figma 429:7549). It reaches iOS only:
 * Android takes `elevation`, which has no colour of its own.
 */
export type ShadowSpec = {
  x: number;
  y: number;
  blur: number;
  alpha: number;
  elevation: number;
  rgb?: string;
};

/**
 * Shadow geometry straight off the artboards. Kept as data rather than pre-built styles so
 * `scaleShadows()` can rebuild them at the device scale — see src/theme/scaleTheme.ts.
 */
export const shadowSpecs = {
  // The nav bar has no entry here. Its shadow is drawn inside `tab-bar-shape.svg`, because the
  // redrawn bar is notched (Figma 429:7519) and a View shadow — boxShadow or elevation — traces
  // the rectangle the view occupies rather than the dip cut out of its top edge.
  /** The violet glow under the FAB (Figma 429:7549): 0 4 10.9 #3C29F6 at 75%, as drawn on 390. */
  fab: { x: 0, y: 5.333, blur: 14.533, alpha: 0.75, elevation: 10, rgb: '60, 41, 246' },
  stickyBarUp: { x: 0, y: -2, blur: 7, alpha: 0.07, elevation: 6 },
  card: { x: 0, y: 1, blur: 2, alpha: 0.05, elevation: 1 },
  /**
   * Onboarding slide 3's feature cards (Figma 307:4298), which are drawn far softer and deeper
   * than the app's own card: 0 4.685 6.09 rgba(29,40,53,0.08) on the 422.66 board, converted
   * into 520-space here so `board()` is not applied to it twice.
   */
  onboardingFeatureCard: { x: 0, y: 5.764, blur: 7.492, alpha: 0.08, elevation: 3 },
  sheet: { x: 0, y: -4, blur: 32, alpha: 0.18, elevation: 12 },
  /** A centred dialog over a scrim (TAILOR 00c 634:633): 0 12 40 at 20%, drawn on 390. */
  dialog: { x: 0, y: 16, blur: 53.333, alpha: 0.2, elevation: 16 },
  /** Segmented-control active pill (Figma 1:284). */
  segmentPill: { x: 0, y: 1, blur: 3, alpha: 0.08, elevation: 2 },
  /** Jobs cards use a slightly tighter shadow than the Home cards (Figma 1:301). */
  jobCard: { x: 0, y: 1, blur: 1, alpha: 0.05, elevation: 1 },
  /** Salary range slider thumb (Figma 1:801). */
  sliderThumb: { x: 0, y: 1, blur: 4, alpha: 0.15, elevation: 3 },
  /** Floating page in the resumes first-run illustration (Figma 1:2067). */
  docFloat: { x: 0, y: 6, blur: 20, alpha: 0.1, elevation: 6 },
  /** Toggle knob (Figma 1:2722). */
  knob: { x: 0, y: 1, blur: 2, alpha: 0.18, elevation: 2 },
  /** Toast over a scrim-less page (Figma 1:2924). */
  toast: { x: 0, y: 4, blur: 9, alpha: 0.28, elevation: 8 },
  /** The assistant's composer pill (ASSISTANT 01 675:2): 0 4 14 #4733FA at 6%, drawn on 390. */
  composer: { x: 0, y: 5.333, blur: 18.667, alpha: 0.06, elevation: 3, rgb: '71, 51, 250' },
  /** Its round send button (675:5): 0 3 8 #4733FA at 25%, drawn on 390. */
  composerSend: { x: 0, y: 4, blur: 10.667, alpha: 0.25, elevation: 4, rgb: '71, 51, 250' },
  /** Redesign cards (§172): a wide, faint lift — 0 6 24 at 6% at 390. */
  soft: { x: 0, y: 8, blur: 32, alpha: 0.06, elevation: 2, rgb: '17, 24, 39' },
} as const satisfies Record<string, ShadowSpec>;

export type ShadowToken = keyof typeof shadowSpecs | 'none';

// RN 0.76+ renders boxShadow natively on Android too, where `elevation` independently paints
// its own shadow — emitting both stacks two shadows. Elevation still owns Android's sibling
// z-ordering, so keep elevation there and boxShadow (which honours the Figma offsets) on iOS.
const toShadowStyle = (
  { x, y, blur, alpha, elevation, rgb = '0, 0, 0' }: ShadowSpec,
  scale: number,
): ShadowStyle =>
  Platform.OS === 'android'
    ? { elevation }
    : { boxShadow: `${x * scale}px ${y * scale}px ${blur * scale}px rgba(${rgb}, ${alpha})` };

/**
 * The artboard's shadow as CSS, on every platform including Android.
 *
 * `shadows.*` deliberately hands Android `{ elevation }` instead, and for chrome that is the right
 * trade: hwui's shadow is cheap and its sibling z-ordering is load-bearing. But elevation throws
 * the artboard geometry away — offset, blur and alpha are all replaced by a framework curve fitted
 * to one number.
 *
 * That is invisible on a card against a grey page, where the shadow only has to suggest depth, and
 * it is fatal for a surface drawn on its own colour, where the shadow is the *only* thing
 * separating the two. The ATS chip is a `surfaceCard` disc on a `surfaceCard` thumbnail: on Android
 * it had no edge at all, and hwui's downward-and-outward penumbra fell across the thumbnail's own
 * border on the bottom and right rather than onto clean white, so those two arcs fused into the
 * border and the disc read as cropped.
 *
 * Reach for this only for such a surface, and only where tree order already paints it above its
 * siblings — dropping `elevation` drops Android's z-ordering with it.
 */
const toBoxShadow = (
  { x, y, blur, alpha, rgb = '0, 0, 0' }: ShadowSpec,
  scale: number,
): ShadowStyle => ({
  boxShadow: `${x * scale}px ${y * scale}px ${blur * scale}px rgba(${rgb}, ${alpha})`,
});

export function buildArtboardShadows(scale: number): Record<ShadowToken, ShadowStyle> {
  const built = { none: {} } as Record<ShadowToken, ShadowStyle>;
  for (const [key, spec] of Object.entries(shadowSpecs)) {
    built[key as keyof typeof shadowSpecs] = toBoxShadow(spec, scale);
  }
  return built;
}

/**
 * Card surfaces whose shadow is CSS on Android too (owner, 2026-11-09, §209). Android draws an
 * `elevation` shadow outside the view's own alpha, so while a card fades in (a reveal, a tab
 * switch, the app coming back) its shadow stayed solid behind the half-clear card and read as a
 * thick grey frame. A `boxShadow` is part of the view and fades with it. Cards never relied on
 * elevation's sibling z-ordering; the floating chrome (sheet, dialog, FAB, bar, toast's own lift,
 * knobs) keeps `elevation`.
 */
const SURFACE_SHADOWS: ReadonlySet<string> = new Set([
  'card',
  'jobCard',
  'soft',
  'docFloat',
  'onboardingFeatureCard',
]);

/** Builds the shadow style map at a given scale. Offsets and blur scale; alpha and elevation do not. */
export function buildShadows(scale: number): Record<ShadowToken, ShadowStyle> {
  const built = { none: {} } as Record<ShadowToken, ShadowStyle>;
  for (const [key, spec] of Object.entries(shadowSpecs)) {
    built[key as keyof typeof shadowSpecs] = SURFACE_SHADOWS.has(key)
      ? toBoxShadow(spec, scale)
      : toShadowStyle(spec, scale);
  }
  return built;
}

export const shadows = buildShadows(1);

export const opacity = {
  disabled: 0.4,
  pressed: 0.85,
  scrim: 0.5,
  /** The light that travels across a live bar or an AI placeholder. */
  sheen: 0.35,
  /** An analysis scan's band at its brightest. */
  scan: 0.22,
  /** A sparkle's glint at its brightest. */
  glint: 0.9,
  /** The ink that runs along a page's lines while it is being written. */
  ink: 0.45,
} as const;

export const zIndex = {
  content: 0,
  stickyBar: 10,
  tabBar: 20,
  fab: 30,
  scrim: 40,
  sheet: 50,
  toast: 60,
} as const;
