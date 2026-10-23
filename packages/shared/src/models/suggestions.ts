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
