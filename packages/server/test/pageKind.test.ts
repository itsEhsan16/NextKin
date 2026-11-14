import { describe, expect, it } from 'vitest';

import { classifyPage, closedWordingIn, jobLinkCount, leftThePosting, proseWordCount, type PageSignals } from '../src/links/pageKind';
import { readHtml, readRendered } from '../src/links/reading';
import { pageVerdict } from '../src/pipeline/stages/extractJd';

/**
 * What kind of page a link led to (toreview §206). The promise under test: a list of jobs or a
 * posting that was taken down is never read as "the job", and a real posting is never refused
 * because it happens to sit beside other jobs.
 */

const WORDS = Array.from({ length: 160 }, (_, i) => `word${i}`).join(' ');
const JOB = `Senior Designer at Acme. You will lead design work. ${WORDS}`;
const NOW = new Date('2026-11-15T12:00:00Z');
const context = (requested?: string) => ({ now: NOW, ...(requested ? { requested } : {}) });

const posting = (over: Record<string, unknown> = {}) => ({ '@type': 'JobPosting', title: 'Senior Designer', hiringOrganization: 'Acme', description: `<p>${WORDS}</p>`, ...over });
const ld = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
const cards = (n: number) =>
  Array.from({ length: n }, (_, i) => `<li><a href="/jobs/${1000 + i}">Engineer ${i}</a> <span>Berlin</span> <span>Full time</span> <span>Posted today</span></li>`).join('');

const signals = (over: Partial<PageSignals> = {}): PageSignals => ({ postings: 0, listType: false, jobLinks: 0, proseWords: 0, redirected: false, ...over });
const kind = (over: Partial<Parameters<typeof classifyPage>[0]> = {}) => classifyPage({ structured: false, unmatchedPostings: false, signals: signals(), now: NOW, ...over });

describe('the words a page uses to say a posting has closed', () => {
  it.each([
    'This job is no longer available.',
    'Sorry, this position has been filled.',
    'The job you are looking for is no longer open.',
    'This posting has expired',
    'No longer accepting applications',
    'Applications are now closed',
    'Job not found',
    'We’re no longer accepting applications for this role.',
    'This vacancy has been closed.',
  ])('hears "%s"', (line) => {
    expect(closedWordingIn(`Careers at Acme\n${line}\nSee other jobs`)).toBe(line);
  });

  it.each([
    'Applications close on 30 November.',
    'You will close deals and manage the sales pipeline.',
    'Experience filling open roles quickly is a plus.',
    'We are looking for someone who has closed enterprise accounts.',
  ])('does not hear it in "%s"', (line) => {
    expect(closedWordingIn(line)).toBeUndefined();
  });
});

describe('links that open one job each', () => {
  it('counts different jobs once, and not the page itself', () => {
    const hrefs = ['/jobs/1001', '/jobs/1001?utm=x', '/jobs/1002', '/about', '/jobs', 'https://boards.greenhouse.io/acme/jobs/55', 'mailto:hr@acme.test', '/viewjob?jk=abc', '/viewjob?jk=def', '/jobs/999'];
    expect(jobLinkCount(hrefs, 'https://acme.test/jobs/999')).toBe(5);
  });
});

describe('a link that ended somewhere else', () => {
  it.each([
    ['https://acme.test/jobs/48213-designer', 'https://acme.test/jobs'],
    ['https://acme.test/careers/role/77123', 'https://acme.test/careers'],
    ['https://boards.greenhouse.io/acme/jobs/4455667', 'https://boards.greenhouse.io/acme?error=true'],
    ['https://acme.test/job/9f1c2d3e-1111-2222-3333-444455556666', 'https://acme.test/'],
    ['https://acme.test/viewjob?jk=123456', 'https://acme.test/search?q=designer'],
  ])('%s → %s left the posting', (from, to) => {
    expect(leftThePosting(from, to)).toBe(true);
  });

  it.each([
    ['https://acme.test/jobs/48213', 'https://acme.test/jobs/48213/'],
    ['https://acme.test/jobs/48213', 'https://careers.acme.test/en/jobs/48213-senior-designer'],
    ['https://acme.test/jobs/designer', 'https://acme.test/jobs'],
    ['https://acme.test/jobs/48213', 'https://acme.test/login?next=%2Fjobs%2F48213'],
  ])('%s → %s did not', (from, to) => {
    expect(leftThePosting(from, to)).toBe(false);
  });
});

describe('naming the page', () => {
  it('one posting with its description is a job', () => {
    expect(kind({ structured: true })).toBe('job');
    expect(kind({ signals: signals({ proseWords: 300 }) })).toBe('job');
  });

  it('a posting past its closing date, description intact, is a closed job', () => {
    expect(kind({ structured: true, closesAt: '2026-11-01' })).toBe('closed_job');
    expect(kind({ structured: true, closesAt: '2026-11-15' })).toBe('job');
    expect(kind({ structured: true, closesAt: 'soon' })).toBe('job');
  });

  it('a closed notice above the description is a closed job; alone, the posting is removed', () => {
    expect(kind({ signals: signals({ closedWording: 'This job is no longer available.', proseWords: 300 }) })).toBe('closed_job');
    expect(kind({ signals: signals({ closedWording: 'This job is no longer available.', proseWords: 12 }) })).toBe('removed');
  });

  it('a closed notice above the site’s other jobs is removed, not a list', () => {
    expect(kind({ signals: signals({ closedWording: 'This position has been filled.', jobLinks: 20, proseWords: 0 }) })).toBe('removed');
  });

  it('many job links and no prose is a list', () => {
    expect(kind({ signals: signals({ jobLinks: 12, proseWords: 30 }) })).toBe('listing');
    expect(kind({ signals: signals({ listType: true, jobLinks: 4 }) })).toBe('listing');
  });

  it('a real description beside many other jobs is still a job', () => {
    expect(kind({ signals: signals({ jobLinks: 25, proseWords: 400 }) })).toBe('job');
    expect(kind({ structured: true, signals: signals({ jobLinks: 25, listType: true, redirected: true }) })).toBe('job');
  });

  it('a thin page is unknown: a browser may still show more', () => {
    expect(kind({ signals: signals({ jobLinks: 2, proseWords: 0 }) })).toBe('unknown');
  });
});

describe('reading a page for its kind', () => {
  it('a single posting is that job', () => {
    expect(readHtml(ld(posting()), 'https://acme.test/jobs/1', context())).toMatchObject({ pageKind: 'job', structured: true, signals: { postings: 1 } });
  });

  it('no longer takes the first of many postings as the job', () => {
    const page = `${ld([posting({ title: 'Designer', url: 'https://acme.test/jobs/1' }), posting({ title: 'Engineer', url: 'https://acme.test/jobs/2' }), posting({ title: 'Analyst', url: 'https://acme.test/jobs/3' })])}<main><ul>${cards(20)}</ul></main>`;
    const reading = readHtml(page, 'https://acme.test/jobs', context());
    expect(reading).toMatchObject({ pageKind: 'listing', structured: false, signals: { postings: 3 } });
    expect(reading.title).toBeUndefined();
  });

  it('reads the one posting that names this address, among several', () => {
    const page = ld({ '@graph': [posting({ title: 'Designer', url: 'https://acme.test/jobs/1' }), posting({ title: 'Engineer', url: 'https://acme.test/jobs/2/' }), posting({ title: 'Analyst', identifier: { '@type': 'PropertyValue', value: '778899' } })] });
    expect(readHtml(page, 'https://acme.test/jobs/2', context())).toMatchObject({ pageKind: 'job', structured: true, title: 'Engineer' });
    expect(readHtml(page, 'https://acme.test/apply?ref=778899', context())).toMatchObject({ pageKind: 'job', title: 'Analyst' });
  });

  it('counts the same posting published twice as one', () => {
    expect(readHtml(ld(posting()) + ld(posting()), 'https://acme.test/jobs/1', context())).toMatchObject({ pageKind: 'job', signals: { postings: 1 } });
  });

  it('finds postings wrapped in an ItemList', () => {
    const list = { '@type': 'ItemList', itemListElement: [1, 2, 3].map((i) => ({ '@type': 'ListItem', position: i, item: posting({ title: `Role ${i}`, url: `https://acme.test/jobs/${i}` }) })) };
    expect(readHtml(`${ld(list)}<main><ul>${cards(20)}</ul></main>`, 'https://acme.test/careers', context())).toMatchObject({ pageKind: 'listing', signals: { postings: 3, listType: true } });
  });

  it('a list of job cards with no data block is a list', () => {
    expect(readHtml(`<title>Jobs at Acme</title><main><h1>Open roles</h1><ul>${cards(20)}</ul></main>`, 'https://acme.test/jobs', context())).toMatchObject({ pageKind: 'listing', signals: { jobLinks: 20 } });
  });

  it('a posting with similar jobs under it is still the job', () => {
    expect(readHtml(`<main><h1>Senior Designer</h1><p>${JOB}</p><h2>Similar jobs</h2><ul>${cards(20)}</ul></main>`, 'https://acme.test/jobs/999', context())).toMatchObject({ pageKind: 'job' });
  });

  it('a notice with nothing under it is a removed posting, even when the notice is outside main', () => {
    expect(readHtml('<title>Acme</title><body><header><p>Sorry, this position has been filled.</p></header><main><a href="/jobs">See open roles</a></main></body>', 'https://acme.test/jobs/1', context())).toMatchObject({
      pageKind: 'removed',
      closedNote: 'Sorry, this position has been filled.',
    });
  });

  it('a notice above the full description is a closed job, and keeps the description', () => {
    const reading = readHtml(`<main><div>This job is no longer accepting applications.</div><h1>Senior Designer</h1><p>${JOB}</p></main>`, 'https://acme.test/jobs/1', context());
    expect(reading).toMatchObject({ pageKind: 'closed_job', closedNote: 'This job is no longer accepting applications.' });
    expect(reading.text).toContain('Senior Designer at Acme');
  });

  it('a posting whose data says it closed last month is a closed job', () => {
    expect(readHtml(ld(posting({ validThrough: '2026-10-01T00:00:00Z' })), 'https://acme.test/jobs/1', context())).toMatchObject({ pageKind: 'closed_job', closesAt: '2026-10-01T00:00:00Z' });
  });

  it('a job link that landed on the site’s front page is a list, whatever the page says', () => {
    expect(readHtml(`<main><p>${JOB}</p></main>`, 'https://acme.test/careers', context('https://acme.test/careers/role/77123'))).toMatchObject({ pageKind: 'listing', signals: { redirected: true } });
  });

  it('judges a page a browser drew the same way', () => {
    const hrefs = Array.from({ length: 12 }, (_, i) => `https://acme.test/jobs/${i + 2000}`);
    const text = Array.from({ length: 30 }, (_, i) => `Engineer ${i}\nBerlin\nFull time`).join('\n');
    expect(readRendered({ url: 'https://acme.test/jobs', title: 'Jobs', text, jsonLd: [], hrefs }, context())).toMatchObject({ pageKind: 'listing' });
    expect(readRendered({ url: 'https://acme.test/jobs/5', title: 'Role', text: JOB, jsonLd: [], hrefs }, context())).toMatchObject({ pageKind: 'job' });
  });

  it('counts prose by the line', () => {
    expect(proseWordCount('Engineer\nBerlin\nFull time')).toBe(0);
    expect(proseWordCount(`short line\n${WORDS}`)).toBe(160);
  });
});

describe('the model’s view of the page, as code keeps it', () => {
  const list = ['Open roles at Acme', 'Senior Designer — Berlin', 'Backend Engineer — Remote', 'Data Analyst — Pune', 'Office Manager — Berlin'].join('\n');

  it('believes a list only when three of its job titles are in the text', () => {
    expect(pageVerdict(list, { kind: 'several_jobs', quote: null, jobTitles: ['Senior Designer', 'Backend Engineer', 'Data Analyst'] })).toEqual({ kind: 'several_jobs' });
    expect(pageVerdict(list, { kind: 'several_jobs', quote: null, jobTitles: ['Senior Designer', 'Backend Engineer'] })).toBeUndefined();
    expect(pageVerdict(list, { kind: 'several_jobs', quote: null, jobTitles: ['Senior Designer', 'senior designer', 'Chief Wizard', 'Head of Magic'] })).toBeUndefined();
  });

  it('believes "closed" only with the words that say so, found in the text', () => {
    const text = `This job is no longer accepting applications.\n${JOB}`;
    expect(pageVerdict(text, { kind: 'closed', quote: 'This job is no longer accepting applications.', jobTitles: [] })).toEqual({ kind: 'closed', note: 'This job is no longer accepting applications.' });
    expect(pageVerdict(text, { kind: 'closed', quote: 'This role was closed yesterday.', jobTitles: [] })).toBeUndefined();
    expect(pageVerdict(text, { kind: 'closed', quote: 'You will lead design work.', jobTitles: [] })).toBeUndefined();
    expect(pageVerdict(text, { kind: 'closed', quote: null, jobTitles: [] })).toBeUndefined();
  });

  it('says nothing for one job, or for a reading made before the page was asked about', () => {
    expect(pageVerdict(JOB, { kind: 'single_job', quote: null, jobTitles: [] })).toBeUndefined();
    expect(pageVerdict(JOB, undefined)).toBeUndefined();
    expect(pageVerdict(JOB, null)).toBeUndefined();
  });
});
