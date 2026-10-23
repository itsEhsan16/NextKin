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
 * on the board. The art sits in an area as wide as the profile card (x 936, 519 wide) that ends
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
    src: '/illustrations/onboarding-name.png',
    width: 1050,
    height: 966,
    x: 936,
    y: 103,
    w: 525,
  },
  goal: {
    src: '/illustrations/onboarding-goal.png',
    width: 1086,
    height: 848,
    x: 924,
    y: 139,
    w: 543,
  },
  experience: {
    src: '/illustrations/onboarding-experience.png',
    width: 1116,
    height: 834,
    x: 898,
    y: 142,
    w: 558,
  },
  resume: {
    src: '/illustrations/onboarding-resume.png',
    width: 1050,
    height: 700,
    x: 945,
    y: 191,
    w: 525,
  },
  upload: {
    src: '/illustrations/onboarding-upload.png',
    width: 1110,
    height: 816,
    x: 900,
    y: 150,
    w: 555,
  },
  work: {
    src: '/illustrations/onboarding-work.png',
    width: 1114,
    height: 842,
    x: 936,
    y: 177,
    w: 557,
  },
  skills: {
    src: '/illustrations/onboarding-skills.png',
    width: 1064,
    height: 790,
    x: 936,
    y: 169,
    w: 532,
  },
  education: {
    src: '/illustrations/onboarding-education.png',
    width: 1160,
    height: 780,
    x: 909,
    y: 165,
    w: 580,
  },
  done: {
    src: '/illustrations/onboarding-done.png',
    width: 1264,
    height: 1124,
    x: 885,
    y: 169,
    w: 632,
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
