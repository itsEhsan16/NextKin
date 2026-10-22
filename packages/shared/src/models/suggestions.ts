/**
 * Reference vocabularies the product ships with — what the chip editors offer while you type.
 *
 * These are product copy, not fixtures: they survive the swap to the real API (the server will
 * send its own, but the shape and the fallback are ours), so they live beside the models rather
 * than in `@/data/mock`, which screens are forbidden to import.
 *
 * Display casing, unlike `SKILL_DICTIONARY` in the mock JD extractor — that one is lowercase
 * because it does case-insensitive matching, and it answers a different question.
 */

/** Offered under the skills field on the profile and in the résumé section editor (V2 §7.3). */
export const SKILL_SUGGESTIONS: readonly string[] = [
  'Design systems',
  'User research',
  'Prototyping',
  'Figma',
  'Accessibility',
  'Information architecture',
  'Interaction design',
  'Usability testing',
  'A/B testing',
  'Design tokens',
  'Wireframing',
  'Visual design',
  'Mobile UX',
  'Stakeholder management',
  'Product strategy',
  'Roadmapping',
  'Data analysis',
  'Mixpanel',
  'Amplitude',
  'Jira',
  'Storybook',
  'HTML',
  'CSS',
  'JavaScript',
  'TypeScript',
  'React',
  'React Native',
  'SQL',
  'Design ops',
  'Service design',
  'Content design',
  'Motion design',
  'Illustration',
  'User flows',
  'Journey mapping',
  'Competitive analysis',
];

/**
 * Offered under "Desired roles" (V2 §7.3, capped by MAX_DESIRED_ROLES). Titles as an Indian
 * product-design job board writes them, matching the job fixtures.
 */
export const ROLE_SUGGESTIONS: readonly string[] = [
  'Product Designer',
  'Senior Product Designer',
  'Staff Product Designer',
  'Lead Product Designer',
  'UX Designer',
  'Senior UX Designer',
  'UI Designer',
  'Design Systems Lead',
  'UX Researcher',
  'Interaction Designer',
  'Design Manager',
  'Principal Designer',
];

/**
 * Offered under "Locations" (V2 §7.3). The Indian metros the job fixtures hire in, plus the two
 * non-city answers people actually give.
 */
export const CITY_SUGGESTIONS: readonly string[] = [
  'Bengaluru',
  'Hyderabad',
  'Pune',
  'Mumbai',
  'Chennai',
  'Delhi NCR',
  'Gurugram',
  'Noida',
  'Kolkata',
  'Ahmedabad',
  'Remote',
  'Anywhere in India',
];

/**
 * Skills offered for a job title: web onboarding's "Suggestions come from your job title"
 * (ONB 06, Figma 808:175). Matched by the words in the title, so "Senior UX Designer" and
 * "Product Designer" both reach the design set. They are only offered: nothing is picked for the
 * user, who taps the ones they really use. A title nothing matches gets the general set.
 */
const TITLE_SKILLS: readonly { match: RegExp; skills: readonly string[] }[] = [
  {
    match: /\b(ux|ui|design|designer|interaction|visual|researcher)\b/i,
    skills: [
      'User research',
      'Design systems',
      'Figma',
      'Prototyping',
      'Interaction design',
      'Usability testing',
      'Wireframing',
      'Accessibility',
      'Information architecture',
      'Visual design',
      'Interaction prototyping in code',
      'Workshop facilitation',
      'Design QA',
    ],
  },
  {
    match: /\b(product manager|product owner|pm)\b/i,
    skills: [
      'Product strategy',
      'Roadmapping',
      'Stakeholder management',
      'User research',
      'Data analysis',
      'A/B testing',
      'Prioritisation',
      'Writing specs',
      'Jira',
      'Go-to-market',
    ],
  },
  {
    match:
      /\b(engineer|developer|programmer|frontend|front-end|backend|back-end|full[- ]?stack)\b/i,
    skills: [
      'JavaScript',
      'TypeScript',
      'React',
      'Node.js',
      'HTML',
      'CSS',
      'SQL',
      'Testing',
      'Git',
      'APIs',
      'System design',
      'Code review',
    ],
  },
  {
    match: /\b(data|analyst|analytics|scientist)\b/i,
    skills: [
      'SQL',
      'Data analysis',
      'Python',
      'Excel',
      'Dashboards',
      'Statistics',
      'A/B testing',
      'Data visualisation',
      'Mixpanel',
      'Amplitude',
    ],
  },
];

const GENERAL_SKILLS: readonly string[] = [
  'Communication',
  'Teamwork',
  'Problem solving',
  'Project management',
  'Stakeholder management',
  'Presentation',
  'Excel',
  'Time management',
];

export function skillSuggestionsForTitle(title: string | undefined): readonly string[] {
  const words = title?.trim() ?? '';
  if (!words) return GENERAL_SKILLS;
  return TITLE_SKILLS.find((family) => family.match.test(words))?.skills ?? GENERAL_SKILLS;
}
