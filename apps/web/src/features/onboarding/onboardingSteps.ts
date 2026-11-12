import type { Route } from 'next';

/**
 * The onboarding pages in order (`toreview.md` §106–§107). The four questions count as four
 * steps; ONB 04b, the upload, is the fourth question's "yes" and stays on step 4. The "no" leads to
 * three quick questions (05–07), which count on their own: "A few quick questions · 1 of 3".
 * `flow` picks the profile card's rows: the quick questions swap Resume for Recent job and Skills.
 * ONB 08, the starting point, ends both ways in: "All done", with no card beside it.
 */
export const ONBOARDING_PAGES = [
  { path: '/onboarding', key: 'name', flow: 'questions', step: 1 },
  { path: '/onboarding/goal', key: 'goal', flow: 'questions', step: 2 },
  { path: '/onboarding/experience', key: 'experience', flow: 'questions', step: 3 },
  { path: '/onboarding/resume', key: 'resume', flow: 'questions', step: 4 },
  { path: '/onboarding/upload', key: 'upload', flow: 'questions', step: 4 },
  { path: '/onboarding/work', key: 'work', flow: 'build', step: 1 },
  { path: '/onboarding/skills', key: 'skills', flow: 'build', step: 2 },
  { path: '/onboarding/education', key: 'education', flow: 'build', step: 3 },
  { path: '/onboarding/done', key: 'done', flow: 'done', step: 1 },
] as const satisfies readonly {
  path: Route;
  key: string;
  flow: 'questions' | 'build' | 'done';
  step: number;
}[];

export type OnboardingPage = (typeof ONBOARDING_PAGES)[number];
export type OnboardingPageKey = OnboardingPage['key'];
export type OnboardingFlow = OnboardingPage['flow'];

/** Each flow's count and how the header names a step in it (808:9, 808:95). */
export const FLOW_PROGRESS: Record<
  OnboardingFlow,
  { total: number; label: (step: number) => string }
> = {
  questions: { total: 4, label: (step) => `Step ${step} of 4` },
  build: { total: 3, label: (step) => `A few quick questions · ${step} of 3` },
  done: { total: 1, label: () => 'All done' },
};

/** Where "Skip for now" and ONB 08's "Go to my dashboard" go: Home. */
export const ONBOARDING_EXIT: Route = '/';

export function pageFor(pathname: string): OnboardingPage {
  return ONBOARDING_PAGES.find((page) => page.path === pathname) ?? ONBOARDING_PAGES[0];
}

/**
 * Each board's raster art (`817:30`–`817:42`, `821:382`–`821:396`), exported at 2x, with its box
 * on the board (the clay art since 2026-11-13 is sized to fit the area's height, centred in it).
 * The art sits in an area as wide as the profile card (x 936, 519 wide) that ends
 * where the card starts (y 590), and each drawing keeps its board offset inside it at whatever
 * size the column is. The quick questions' card has five rows, not four, so their area starts
 * lower, at y 160, where their art leaves the space empty anyway; ONB 07's has six, so its starts
 * just below its drawing's own top. ONB 08 has no card: its drawing fills the column on its own.
 */
export const STEP_ART: Record<
  OnboardingPageKey,
  { src: string; width: number; height: number; x: number; y: number; w: number }
> = {
  name: {
    src: '/illustrations/v2/onboarding-name.webp',
    width: 277,
    height: 560,
    x: 1099,
    y: 103,
    w: 193,
  },
  goal: {
    src: '/illustrations/v2/onboarding-goal.webp',
    width: 495,
    height: 560,
    x: 1036,
    y: 139,
    w: 319,
  },
  experience: {
    src: '/illustrations/v2/onboarding-experience.webp',
    width: 537,
    height: 560,
    x: 1024,
    y: 142,
    w: 344,
  },
  resume: {
    src: '/illustrations/v2/onboarding-resume.webp',
    width: 446,
    height: 560,
    x: 1068,
    y: 191,
    w: 254,
  },
  upload: {
    src: '/illustrations/v2/onboarding-upload.webp',
    width: 446,
    height: 560,
    x: 1055,
    y: 150,
    w: 280,
  },
  work: {
    src: '/illustrations/v2/onboarding-work.webp',
    width: 560,
    height: 477,
    x: 1002,
    y: 177,
    w: 388,
  },
  skills: {
    src: '/illustrations/v2/onboarding-skills.webp',
    width: 440,
    height: 560,
    x: 1063,
    y: 169,
    w: 265,
  },
  education: {
    src: '/illustrations/v2/onboarding-education.webp',
    width: 560,
    height: 428,
    x: 1001,
    y: 165,
    w: 389,
  },
  done: {
    src: '/illustrations/v2/onboarding-done.webp',
    width: 500,
    height: 560,
    x: 1045,
    y: 169,
    w: 301,
  },
};

const ART_AREA = { x: 936, width: 519, bottom: 590 };
const ART_AREA_TOP: Record<OnboardingFlow, number> = { questions: 103, build: 160, done: 169 };

/** The art area's aspect ratio, and a drawing's box in it as fractions, for the frame to place. */
export function artLayout(page: OnboardingPage) {
  const art = STEP_ART[page.key];
  // ONB 07's six-row card leaves less room: its area starts 20 below the drawing, which then rides
  // up into the empty space under the header rather than being cut.
  const top = page.key === 'education' ? art.y + 20 : ART_AREA_TOP[page.flow];
  const height = ART_AREA.bottom - top;
  return {
    art,
    aspect: `${ART_AREA.width} / ${height}`,
    left: (art.x - ART_AREA.x) / ART_AREA.width,
    top: (art.y - top) / height,
    size: art.w / ART_AREA.width,
  };
}
