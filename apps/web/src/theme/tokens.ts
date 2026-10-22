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
  textCompany: '#78839a',
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
  warningText: '#b7791f',
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
  /** The Assistant's welcome greeting only (`toreview.md` §102). */
  hero: [32, 40, -2, 800],
  displayL: [24, 30, -1.5, 700],
  h1: [20, 26, -1, 600],
  h2: [18, 24, -0.8, 600],
  titleL: [15, 20, -0.3, 600],
  /** Primary UI text — inputs, buttons, tabs, list text, nav labels (`toreview.md` §29). */
  bodyL: [14, 20, 0, 400],
  /** Running copy — the job description and its lists: the primary size on a looser line. */
  prose: [14, 22, 0, 400],
  /** Secondary text — subtitles, card body. */
  bodyM: [13, 20, 0, 400],
  bodyS: [12, 18, 0, 400],
  captionM: [12, 16, 0, 500],
  micro: [11, 14, 0.2, 500],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type TypographyRole = keyof typeof typography;

export const space = [2, 4, 6, 8, 12, 16, 20, 24] as const;

/** The three control heights (`h-control-*`, `size-control-*`) — see theme.css. */
export const controls = { sm: 30, md: 36, lg: 40 } as const;

export const radii = { sm: 6, md: 8, lg: 12, xl: 16, panel: 31, full: 999 } as const;

/** Elevation (`toreview.md` §32): a whisper under cards; real depth only for popovers. */
export const shadows = {
  card: '0 1px 2px rgba(15, 23, 42, 0.04)',
  popover: '0 4px 16px rgba(15, 23, 42, 0.08)',
  raised: '0 1px 3px rgba(15, 23, 42, 0.1), 0 1px 2px rgba(15, 23, 42, 0.06)',
} as const;

/**
 * Motion. Carried over from `apps/mobile/src/theme/motion.ts` — these describe how the product
 * feels rather than how a phone lays out, so they transfer where the layout tokens do not.
 */
export const motion = {
  durations: { press: 120, fast: 180, base: 220, snappy: 250, meter: 800, slide: 600, float: 2800 },
  easings: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  },
  /** What a held button or card settles to, and what menus and tooltips grow from. */
  pressedScale: 0.98,
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
