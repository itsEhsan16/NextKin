/**
 * TAILOR 00c (copied job link). Nothing in the mock can fetch a page, so a copied link is read
 * from its own address instead: the host names the company and the last path segment names the
 * role — "careers.swiggy.com/jobs/senior-product-designer-4821" is a Senior Product Designer at
 * Swiggy. A real server reads the page itself; this is a stand-in, as `jdExtractor`'s link body
 * is.
 */

/** "https://www.cred.club/careers?x=1" → "cred.club". */
export function linkHost(url: string): string {
  const match = /^(?:[a-z]+:\/\/)?([^/?#]+)/i.exec(url.trim());
  return (match?.[1] ?? '').replace(/^www\./i, '').toLowerCase();
}

/** Sites that list other companies' jobs: their name is not the employer's. */
const JOB_BOARDS = new Set([
  'linkedin',
  'naukri',
  'indeed',
  'glassdoor',
  'greenhouse',
  'lever',
  'workday',
  'myworkdayjobs',
  'wellfound',
  'instahyre',
  'foundit',
  'iimjobs',
  'cutshort',
]);
/** Sub-domains that say "this is a careers site", not who runs it. */
const CAREERS_PREFIXES = new Set(['careers', 'career', 'jobs', 'job', 'apply', 'boards', 'hire']);
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'ac', 'gov']);
const ACRONYMS = new Set([
  'ux',
  'ui',
  'qa',
  'hr',
  'ai',
  'ml',
  'sre',
  'vp',
  'cto',
  'ceo',
  'ios',
  'api',
]);

const titleCase = (word: string): string =>
  ACRONYMS.has(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1);

/** The employer, from the host — undefined for a job board, which names no one. */
export function companyFromHost(host: string): string | undefined {
  const labels = host.split('.').filter(Boolean);
  if (labels.length < 2) return undefined;
  labels.pop(); // the TLD
  const last = labels[labels.length - 1];
  if (labels.length > 1 && last && SECOND_LEVEL.has(last)) labels.pop(); // co.in, com.au
  const name = labels.filter((label) => !CAREERS_PREFIXES.has(label)).pop();
  if (!name || JOB_BOARDS.has(name)) return undefined;
  // Short names are usually initialisms (cred.club → CRED); longer ones read as words.
  return name.length <= 4 ? name.toUpperCase() : titleCase(name);
}

/** The role, from the last path segment that reads as words; undefined when none does. */
export function titleFromPath(url: string): string | undefined {
  const path = url
    .trim()
    .replace(/^(?:[a-z]+:\/\/)?[^/?#]+/i, '')
    .split(/[?#]/)[0];
  const segments = (path ?? '').split('/').filter(Boolean).reverse();
  for (const segment of segments) {
    const words = decodeURIComponent(segment)
      .toLowerCase()
      .split(/[-_+\s]+/)
      .filter((word) => /^[a-z]+$/.test(word));
    if (words.length >= 2) return words.map(titleCase).join(' ');
  }
  return undefined;
}
