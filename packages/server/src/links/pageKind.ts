/**
 * What kind of page a link led to (owner, 2026-11-15; toreview §206). A link to a posting that has
 * closed often still answers 200: with a notice and nothing else, with the site's list of other
 * jobs, or with the old description under a "closed" banner. Reading any of those as "the job"
 * gives the candidate a resume aimed at the wrong thing, so the page is named before it is used.
 *
 * Code decides from what the page itself says: its JobPosting blocks, its links, its wording and
 * where the link ended up. It is deliberately cautious about calling a page a list: a posting with
 * real prose is left for the model's reading to judge (`jd.extract`'s `page` field), because a
 * wrong refusal costs the candidate more than a second look does.
 */

export type PageKind =
  /** One posting, open as far as the page says. */
  | 'job'
  /** One posting whose description is still there, but which says it has closed. */
  | 'closed_job'
  /** A list of jobs or a search page: several postings, none of them the one asked for. */
  | 'listing'
  /** The posting was taken down: a notice, with no description left to read. */
  | 'removed'
  | 'unknown';

export interface PageSignals {
  /** Distinct JobPosting blocks in the page's JSON-LD. */
  postings: number;
  /** The page calls itself a list or a search result in its JSON-LD. */
  listType: boolean;
  /** Distinct links that look like they open one job each. */
  jobLinks: number;
  /** Words in lines long enough to be description prose rather than a card or a menu. */
  proseWords: number;
  /** The page's own words saying the posting has closed. */
  closedWording?: string;
  /** The link ended somewhere that no longer names the job it started with. */
  redirected: boolean;
}

/** A page with this much prose has a description on it, whatever else it carries. */
export const PROSE_WORDS = 120;
const PROSE_LINE_WORDS = 10;
const MANY_JOB_LINKS = 8;
/** A page that calls itself a list needs fewer links to be believed. */
const FEW_JOB_LINKS = 3;

const THING = '(?:job|position|posting|role|vacancy|listing|opening|opportunity|requisition|advert(?:isement)?)';
const CLOSED = new RegExp(
  [
    `\\b(?:this|the) ${THING}(?: you(?:['’]re| are) looking for| you requested)? (?:is|has been|has|was|may have been) (?:no longer (?:available|open|active|listed|posted|accepting applications)|not available|unavailable|(?:now |already )?(?:closed|filled|expired|removed|taken down|unpublished|archived|deleted))`,
    `\\b${THING} (?:is |has )?(?:no longer (?:available|open|active|accepting applications)|not found|expired|has expired|has been filled|has been closed|has been removed)`,
    `\\bno longer accepting applications\\b`,
    `\\bapplications? (?:for this ${THING} )?(?:are|is|have|has) (?:now |been )?closed\\b`,
    `\\bwe(?: are|['’]re) no longer (?:accepting|taking) applications\\b`,
    `\\bsorry,? (?:but )?(?:this|the) ${THING} (?:is|has)\\b`,
  ].join('|'),
  'i',
);

/** The sentence a page uses to say its posting has closed, if it says so. */
export function closedWordingIn(text: string): string | undefined {
  const match = CLOSED.exec(text);
  if (!match) return undefined;
  const line = text.slice(text.lastIndexOf('\n', match.index) + 1).split('\n')[0] ?? match[0];
  return line.trim().slice(0, 200) || match[0];
}

export const proseWordCount = (text: string): number =>
  text
    .split('\n')
    .map((line) => line.split(/\s+/).filter(Boolean).length)
    .filter((words) => words >= PROSE_LINE_WORDS)
    .reduce((sum, words) => sum + words, 0);

const JOB_PATH = /\/(?:jobs?|careers?|positions?|openings?|vacanc(?:y|ies)|viewjob|job-details?|job-listings?|postings?|requisitions?|opportunit(?:y|ies))\/[^/?#]+/i;
const JOB_QUERY = ['jk', 'vjk', 'gh_jid', 'jobid', 'job_id', 'jid', 'currentjobid'];
const JOB_HOST = /^(?:jobs|careers|boards|apply|job-boards)\./i;

function opensAJob(url: URL): boolean {
  if (JOB_PATH.test(url.pathname)) return true;
  for (const [key] of url.searchParams) if (JOB_QUERY.includes(key.toLowerCase())) return true;
  return JOB_HOST.test(url.hostname) && url.pathname.split('/').filter(Boolean).length >= 2;
}

const pathOf = (url: URL): string => url.pathname.replace(/\/+$/, '') || '/';

/** How many different jobs a page links to, the page's own address aside. */
export function jobLinkCount(hrefs: readonly string[], page: string): number {
  let base: URL;
  try {
    base = new URL(page);
  } catch {
    return 0;
  }
  const seen = new Set<string>();
  for (const href of hrefs) {
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
    if (url.host === base.host && pathOf(url) === pathOf(base) && url.search === base.search) continue;
    if (!opensAJob(url)) continue;
    seen.add(`${url.host}${pathOf(url)}?${JOB_QUERY.map((key) => url.searchParams.get(key) ?? '').join('&')}`);
  }
  return seen.size;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The parts of an address that name one posting: a long number, or a UUID. */
function idsOf(url: URL): string[] {
  const parts = [...url.pathname.split(/[/_.-]+/), ...url.pathname.split('/'), ...[...url.searchParams.values()]];
  return [...new Set(parts.filter((part) => /^\d{4,}$/.test(part) || UUID.test(part)).map((part) => part.toLowerCase()))];
}

const LIST_PATH = /(?:^|\/)(?:jobs?|careers?|search|job-search|openings|positions|vacancies|results|opportunities)$/i;

/**
 * Whether a link that named one posting ended on a page that no longer does. Sites send a closed
 * posting's address to their job list, their search page or their front door.
 */
export function leftThePosting(requested: string, final: string): boolean {
  let from: URL;
  let to: URL;
  try {
    from = new URL(requested);
    to = new URL(final);
  } catch {
    return false;
  }
  if (from.host === to.host && pathOf(from) === pathOf(to)) return false;
  const ids = idsOf(from);
  if (ids.length === 0) return false;
  const landed = to.href.toLowerCase();
  if (ids.some((id) => landed.includes(id))) return false;
  const path = pathOf(to);
  const shorter = from.host === to.host && path !== pathOf(from) && (path === '/' || pathOf(from).startsWith(`${path}/`));
  return shorter || path === '/' || LIST_PATH.test(path) || to.searchParams.has('error') || to.searchParams.has('q') || to.searchParams.has('keywords');
}

export interface PageFacts {
  /** A single JobPosting block supplied the reading. */
  structured: boolean;
  /** Several JobPosting blocks, and none of them is the one the link asked for. */
  unmatchedPostings: boolean;
  signals: PageSignals;
  closesAt?: string | undefined;
  now: Date;
}

const hasPassed = (closesAt: string | undefined, now: Date): boolean => {
  if (!closesAt) return false;
  const at = Date.parse(closesAt);
  if (Number.isNaN(at)) return false;
  // A date with no time means the end of that day.
  const end = /^\d{4}-\d{2}-\d{2}$/.test(closesAt.trim()) ? at + 24 * 60 * 60 * 1000 : at;
  return end < now.getTime();
};

export function classifyPage(facts: PageFacts): PageKind {
  const { structured, unmatchedPostings, signals, closesAt, now } = facts;
  const said = signals.closedWording !== undefined;
  const described = structured || signals.proseWords >= PROSE_WORDS;
  const listLike = !structured && (unmatchedPostings || signals.redirected || ((signals.jobLinks >= MANY_JOB_LINKS || (signals.listType && signals.jobLinks >= FEW_JOB_LINKS)) && signals.proseWords < PROSE_WORDS));

  if (said && (!described || listLike)) return 'removed';
  if (listLike) return 'listing';
  if (described && (said || hasPassed(closesAt, now))) return 'closed_job';
  if (described) return 'job';
  return 'unknown';
}
