/**
 * The token values, as data.
 *
 * `theme.css` is the source Tailwind reads; this mirrors it for the places a class name cannot
 * reach — an SVG `stroke`, a canvas fill, a chart scale — and gives the token set a shape tests
 * can assert against. The two must agree, and `__tests__/theme/tokens.test.ts` is what proves it.
 *
 * Transcribed from the Figma variable collection bound to `286:180`. Not mobile's palette: see
 * the note at the top of `theme.css`.
 */
export const colors = {
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textTertiary: '#64748b',
  textInverse: '#ffffff',
  textBrand: '#4f46e5',
  // Jobs board (304:2332) one-offs — see theme.css for how each was decided.
  textCompany: '#64748b',
  textCaveat: '#3b28f0',

  brand600: '#4f46e5',
  brandOnDark: '#e4e1fc',
  brand700: '#4338ca',

  neutral0: '#ffffff',
  neutral100: '#f1f5f9',
  neutral200: '#e2e8f0',
  neutral400: '#94a3b8',
  neutral700: '#334155',
  neutral800: '#1e293b',

  surfaceCard: '#ffffff',
  surfaceMuted: '#f1f5f9',
  surfaceBrand: '#fbfaff',
  surfaceBrandStrong: '#f2f2fd',
  // The ink primary button (`toreview.md` §32) — same values as textPrimary/neutral800, named
  // for the role they play.
  surfaceInverse: '#0f172a',
  surfaceInverseHover: '#1e293b',

  borderDefault: '#e2e8f0',
  borderSubtle: '#f1f5f9',
  borderBrand: '#ede9fe',
  borderDivider: '#e2e8f0',
  borderFaint: '#f1f5f9',
  borderCard: '#e2e8f0',
  borderSelected: '#6366f1',

  dangerDot: '#ff4148',
  buttonRim: '#6461f0',
  buttonFace: '#4039d6',
  successText: '#15803d',
  successSurface: '#ecfdf5',

  // Applications board (286:1234) status pills — see theme.css.
  brand100: '#e0e7ff',
  success50: '#dcfce7',
  success600: '#16a34a',
  warning50: '#fef3c7',
  warningText: '#b45309',
  danger50: '#fee2e2',
  danger600: '#dc2626',

  // Resumes board (286:1675) document tiles — see theme.css.
  tileIndigo: '#eef0fe',
  tileIndigoInk: '#6366f1',
  tilePink: '#fdecf3',
  tilePinkInk: '#ec4899',
  tileBlue: '#e9f1fe',
  tileBlueInk: '#3b82f6',
  tileGreen: '#e8f8ee',
  tileGreenInk: '#22c55e',
  tileAmber: '#fdf3e0',
  tileAmberInk: '#f59e0b',

  // Documents board (286:2026) — see theme.css.
  neutral50: '#f8fafc',
  brand50: '#eef2ff',
  info50: '#e0f2fe',
  info600: '#0284c7',
  filePdf: '#ef4444',
  fileDocx: '#2563eb',
  fileXlsx: '#10b981',
  fileJpg: '#f59e0b',

  // Account board (307:3443) — see theme.css.
  borderBrandStrong: '#c7cbfa',

  // Settings → Privacy & data mockup — see theme.css.
  borderDanger: '#f1a8a8',
  dangerText: '#b91c1c',

  // Admin portal (Figma 382:936) — the steps of the slate and indigo ramps its boards bind that no
  // user-app board did, and the amber its warning badges draw. See theme.css.
  neutral300: '#cbd5e1',
  neutral500: '#64748b',
  neutral600: '#475569',
  brand200: '#c7d2fe',
  brand300: '#a5b4fc',
  brand500: '#6366f1',
  warning600: '#b45309',

  // Skeletons (§196): the block's fill and the light band that sweeps it. Not hex, so they stay
  // out of SVG/canvas use; listed so theme.css and this file can't drift (redesign R1).
  skeleton: 'color-mix(in srgb, #0f172a 5%, transparent)',
  skeletonLight: 'rgb(255 255 255 / 0.75)',

  // Redesign R2 foundations (02-tokens §2.1–2.2): new ramp steps and the paid ramp.
  brand25: '#fbfaff',
  brand75: '#ede9fe',
  brand400: '#818cf8',
  brand800: '#3730a3',
  brand900: '#312e81',
  brand950: '#1e1b4b',
  neutral900: '#0f172a',
  neutral950: '#020617',
  success100: '#dcfce7',
  success200: '#bbf7d0',
  success400: '#4ade80',
  success500: '#22c55e',
  success700: '#15803d',
  success800: '#166534',
  success950: '#052e16',
  warning100: '#fef3c7',
  warning200: '#fde68a',
  warning400: '#fbbf24',
  warning500: '#f59e0b',
  warning700: '#b45309',
  warning800: '#92400e',
  warning950: '#451a03',
  danger100: '#fee2e2',
  danger200: '#fecaca',
  danger300: '#fca5a5',
  danger400: '#f87171',
  danger500: '#ef4444',
  danger700: '#b91c1c',
  danger800: '#991b1b',
  danger950: '#450a0a',
  info100: '#e0f2fe',
  info200: '#bae6fd',
  info400: '#38bdf8',
  info700: '#0369a1',
  info950: '#082f49',
  paid50: '#fdf4ff',
  paid100: '#fae8ff',
  paid200: '#f5d0fe',
  paid300: '#f0abfc',
  paid500: '#d946ef',
  paid600: '#c026d3',
  paid700: '#a21caf',
  paid800: '#86198f',
  paid950: '#4a044e',

  // Redesign R2 semantic tier (02-tokens §3), resolved to the value it shows in light.
  surfacePage: '#f1f5f9',
  surfaceSubtle: '#f8fafc',
  surfaceRaised: '#ffffff',
  surfaceBrandTint: '#eef2ff',
  surfaceSelected: '#ede9fe',
  surfacePaid: '#fdf4ff',
  surfaceOverlay: 'color-mix(in srgb, #0f172a 40%, transparent)',
  surfaceGlass: 'color-mix(in srgb, #f1f5f9 80%, transparent)',
  surfaceGlassPanel: 'color-mix(in srgb, #ffffff 90%, transparent)',
  textDisabled: '#94a3b8',
  textOnBrand: '#ffffff',
  textLink: '#4f46e5',
  textInverseBrand: '#e0e7ff',
  textPaid: '#a21caf',
  borderStrong: '#94a3b8',
  borderControl: '#64748b',
  borderFocus: '#6366f1',
  borderPaid: '#f5d0fe',
  focusRing: '#4f46e5',
  focusRingInverse: '#e0e7ff',
  focusRingDanger: '#dc2626',
  actionPrimary: '#4f46e5',
  actionPrimaryHover: '#4338ca',
  actionPrimaryPressed: '#3730a3',
  actionSecondary: '#ffffff',
  actionSecondaryHover: '#f1f5f9',
  actionSecondaryPressed: '#e2e8f0',
  actionGhostHover: '#f1f5f9',
  actionGhostPressed: '#e2e8f0',
  actionDanger: '#dc2626',
  actionDangerHover: '#b91c1c',
  actionDangerPressed: '#991b1b',
  actionPaid: '#c026d3',
  actionPaidHover: '#a21caf',
  actionPaidPressed: '#86198f',
  actionInverse: '#0f172a',
  actionInverseHover: '#1e293b',
  actionInversePressed: '#334155',
  feedbackSuccessSurface: '#dcfce7',
  feedbackSuccessBorder: '#bbf7d0',
  feedbackSuccessText: '#15803d',
  feedbackSuccessIcon: '#16a34a',
  feedbackWarningSurface: '#fef3c7',
  feedbackWarningBorder: '#fde68a',
  feedbackWarningText: '#b45309',
  feedbackWarningIcon: '#f59e0b',
  feedbackDangerSurface: '#fee2e2',
  feedbackDangerBorder: '#fecaca',
  feedbackDangerText: '#b91c1c',
  feedbackDangerIcon: '#dc2626',
  feedbackInfoSurface: '#e0f2fe',
  feedbackInfoBorder: '#bae6fd',
  feedbackInfoText: '#0369a1',
  feedbackInfoIcon: '#0284c7',
  feedbackBrandSurface: '#eef2ff',
  feedbackBrandBorder: '#ede9fe',
  feedbackBrandText: '#4f46e5',
  feedbackBrandIcon: '#4f46e5',
  feedbackNeutralSurface: '#f1f5f9',
  feedbackNeutralBorder: '#e2e8f0',
  feedbackNeutralText: '#475569',
  feedbackNeutralIcon: '#64748b',
  scoreStrongSurface: '#dcfce7',
  scoreStrongText: '#15803d',
  scoreStrongArc: '#16a34a',
  scoreGoodSurface: '#f1f5f9',
  scoreGoodText: '#334155',
  scoreGoodArc: '#6366f1',
  scoreFairSurface: '#fef3c7',
  scoreFairText: '#b45309',
  scoreFairArc: '#f59e0b',
  scoreWeakSurface: '#fee2e2',
  scoreWeakText: '#b91c1c',
  scoreWeakArc: '#dc2626',
  scoreNoneSurface: '#f8fafc',
  scoreNoneText: '#475569',
  scoreTrack: '#f1f5f9',
  selectionBg: '#e0e7ff',
  selectionText: '#0f172a',
  chart1: '#4f46e5',
  chart2: '#0284c7',
  chart3: '#16a34a',
  chart4: '#f59e0b',
  chart5: '#ec4899',
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Type roles, `[fontSize, lineHeight, letterSpacing, fontWeight]`.
 *
 * Sizes and line heights are px; **letter-spacing is a percentage of the font size**, which is
 * the unit Figma reports and `theme.css` expresses as `em`. Reading the board's -0.8 on H2 as
 * -0.8px (rather than -0.16px) is the bug this comment exists to prevent recurring.
 *
 * The compact ramp (`toreview.md` §16) — a LinkedIn-like density, not the boards' raw sizes.
 */
export const typography = {
  /** The landing-size display line (`text-display-xl`); was in theme.css only (redesign R1). */
  displayXl: [52, 56, -3, 800],
  /** The Assistant's welcome greeting only (`toreview.md` §102). */
  hero: [34, 42, -2, 800],
  displayL: [30, 38, -2, 700],
  h1: [22, 30, -1.2, 600],
  h2: [18, 26, -0.8, 600],
  titleL: [16, 24, -0.4, 600],
  /** Primary UI text — inputs, buttons, tabs, list text, nav labels (`toreview.md` §29). */
  bodyL: [15, 24, 0, 400],
  /** Running copy — the job description and its lists: the primary size on a looser line. */
  prose: [15, 26, 0, 400],
  /** Secondary text — subtitles, card body. */
  bodyM: [14, 22, 0, 400],
  bodyS: [13, 20, 0, 400],
  captionM: [12, 18, 0, 500],
  micro: [11, 16, 0.2, 500],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type TypographyRole = keyof typeof typography;

export const space = [2, 4, 6, 8, 12, 16, 20, 24] as const;

/**
 * The admin portal's icon sizes (Figma 382:937 and the screens): 12 inside a delta badge, 16 in a
 * queue row or a footnote, 18 in a card header, 20 in a nav row or a button, 24 for a dialog's close. Numbers, because the
 * animated icons take a pixel `size` rather than a class.
 */
export const iconSizes = { xs: 12, sm: 16, md: 18, lg: 20, xl: 24 } as const;

export type IconSize = keyof typeof iconSizes;

/** The three control heights (`h-control-*`, `size-control-*`) — see theme.css. */
export const controls = { sm: 36, md: 40, lg: 44, xl: 48 } as const;

export const radii = { sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, panel: 24, full: 999 } as const;

/** Elevation (`toreview.md` §132): white cards on a grey canvas, lifting on hover. */
export const shadows = {
  card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 8px -2px rgba(15, 23, 42, 0.06)',
  cardHover: '0 2px 4px rgba(15, 23, 42, 0.05), 0 12px 24px -6px rgba(15, 23, 42, 0.12)',
  popover: '0 8px 24px -4px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06)',
  raised: '0 1px 2px rgba(15, 23, 42, 0.06), 0 2px 6px rgba(15, 23, 42, 0.08)',
  /** The admin boards' lift under a field, a button or a card body. */
  xs: '0 1px 2px rgba(16, 24, 40, 0.05)',
  /** The admin boards' buttons: the lift plus a 2px inset shade along the bottom. */
  buttonXs: 'inset 0 -2px 0 rgba(16, 24, 40, 0.05), 0 1px 2px rgba(16, 24, 40, 0.05)',
  /** A page drawn as a sheet on a card (Templates' thumbnails). */
  lg: '0 4px 6px -2px rgba(16, 24, 40, 0.03), 0 12px 16px -4px rgba(16, 24, 40, 0.08)',
  /** The admin boards' modal and side panel. */
  modal: '0 8px 8px -4px rgba(16, 24, 40, 0.03), 0 20px 24px -4px rgba(16, 24, 40, 0.08)',
  dialog: '0 24px 48px -12px rgba(15, 23, 42, 0.25)',
  button: 'inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 1px 2px rgba(15, 23, 42, 0.12)',
} as const;

/**
 * Motion. Carried over from `apps/mobile/src/theme/motion.ts` — these describe how the product
 * feels rather than how a phone lays out, so they transfer where the layout tokens do not.
 */
export const motion = {
  durations: {
    press: 120,
    fast: 180,
    base: 220,
    snappy: 250,
    meter: 800,
    slide: 600,
    float: 2800,
    think: 1400,
    sweep: 2000,
    /** One pass of the skeletons' diagonal light across the window (§196). */
    shimmer: 1600,
    /** How long a skeleton waits before it shows, so a quick load never flashes one (§196). */
    'skeleton-delay': 150,
  },
  /**
   * After a click opens a page, further opens are ignored this long (§196): about one route
   * change, so a double click never pushes the same page twice. Not a CSS duration.
   */
  navGuard: 450,
  easings: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    // A quick settle with no overshoot (§196); it used to pass its target and swing back.
    spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
  },
  /** What a held button or card settles to, and what menus and tooltips grow from. */
  pressedScale: 0.98,
  /** `--stagger-step`: how far apart a chart's columns arrive (the admin Overview). */
  staggerStep: 24,
  /**
   * Waits before something appears, not animation lengths: how long a pointer rests on a rail icon
   * before its label shows. Moving on to the next icon shows that one at once (Radix's skip delay).
   */
  delays: {
    tooltip: 400,
    /** How long a toast stays up (`toreview.md` §85); one with an action stays longer. */
    toast: 4000,
    toastWithAction: 6500,
    /** How long Home's Top Job Matches rests on a pair before the next card slides in. */
    carousel: 5000,
  },
} as const;
