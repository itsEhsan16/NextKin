import type { Certification, Education, Experience, ProfileLink } from '@/data/models';
import {
  certificationExpired,
  certificationRow,
  educationRow,
  experienceRow,
  linkIcon,
  linkRow,
  newestFirst,
  tidyUrl,
} from '@/features/profile/entryRows';

const NOW = new Date('2026-09-06T00:00:00.000Z');

const experience: Experience = {
  id: 'exp_1',
  company: 'Flipkart',
  title: 'Senior UX Designer',
  startDate: '2022-03-01',
  current: true,
  skills: [],
};

const education: Education = {
  id: 'edu_1',
  institution: 'National Institute of Design',
  degree: 'M.Des.',
  startDate: '2014-07-01',
  endDate: '2016-05-31',
  current: false,
};

const certification: Certification = {
  id: 'cert_1',
  name: 'Certified Usability Analyst',
  issuer: 'HFI',
  issuedOn: '2021-04-12',
};

describe('entryRows (V2 §7.3 card copy, PROFILE 04 / 07 / 12)', () => {
  it('reads a current role as Present, marks it Current, and dates a finished one', () => {
    expect(experienceRow(experience)).toEqual({
      id: 'exp_1',
      tile: { kind: 'letter', name: 'Flipkart' },
      title: 'Senior UX Designer',
      subtitle: 'Flipkart',
      meta: 'Mar 2022 – Present',
      pill: { label: 'Current', tone: 'success' },
    });

    const finished = experienceRow({
      ...experience,
      company: 'Swiggy',
      current: false,
      startDate: '2019-06-01',
      endDate: '2022-02-28',
    });
    expect(finished.meta).toBe('Jun 2019 – Feb 2022');
    expect(finished.pill).toBeUndefined();
  });

  it('drops a date the picker never wrote instead of printing an unparseable one', () => {
    expect(experienceRow({ ...experience, current: false, startDate: '' }).meta).toBeUndefined();
  });

  it('labels education by its degree, under the institution and its dates', () => {
    expect(educationRow(education)).toEqual({
      id: 'edu_1',
      tile: { kind: 'letter', name: 'National Institute of Design' },
      title: 'M.Des.',
      subtitle: 'National Institute of Design',
      meta: 'Jul 2014 – May 2016',
    });
  });

  it('lists what is current first, then the rest newest first', () => {
    const older = { ...experience, id: 'exp_old', current: false, startDate: '2016-01-01' };
    const newer = { ...experience, id: 'exp_new', current: false, startDate: '2019-06-01' };
    expect(newestFirst([older, experience, newer]).map((entry) => entry.id)).toEqual([
      'exp_1',
      'exp_new',
      'exp_old',
    ]);
  });

  it('surfaces the per-role skill tags, which §7.3 makes load-bearing', () => {
    // §7.7 validates a generated resume against these, so the list is the one place a user can
    // check them without opening the edit form. They were not rendered anywhere before.
    const tagged = experienceRow({
      ...experience,
      skills: ['Design systems', 'Figma', 'Mobile UX'],
    });

    expect(tagged.tags).toEqual(['Design systems', 'Figma', 'Mobile UX']);
    expect(tagged.title).toBe('Senior UX Designer');
  });

  it('carries the field of study, and omits the line entirely when a fact is missing', () => {
    expect(educationRow({ ...education, field: 'Interaction Design' }).tags).toEqual([
      'Interaction Design',
    ]);
    // Absent rather than an empty array: a row with nothing to tag draws no third line at all.
    expect(educationRow(education).tags).toBeUndefined();
    expect(experienceRow(experience).tags).toBeUndefined();
  });

  it('adds the issued year when there is one and omits it when there is not', () => {
    expect(certificationRow(certification, NOW)).toEqual({
      id: 'cert_1',
      tile: { kind: 'letter', name: 'HFI' },
      title: 'Certified Usability Analyst',
      subtitle: 'HFI',
      meta: 'Issued 2021',
    });

    expect(certificationRow({ ...certification, issuedOn: undefined }, NOW).meta).toBeUndefined();
  });

  it('says so when a credential has lapsed, and stays quiet while it has not', () => {
    const lapsed = { ...certification, expiresOn: '2024-04-12' };
    const live = { ...certification, expiresOn: '2027-04-12' };

    expect(certificationExpired(lapsed, NOW)).toBe(true);
    expect(certificationExpired(live, NOW)).toBe(false);
    expect(certificationExpired(certification, NOW)).toBe(false);

    expect(certificationRow(lapsed, NOW).pill).toEqual({ label: 'Expired', tone: 'danger' });
    expect(certificationRow(live, NOW).pill).toBeUndefined();
  });

  it('tidies a link down to what says where it goes', () => {
    expect(tidyUrl('https://georgesmith.design')).toBe('georgesmith.design');
    expect(tidyUrl('https://www.linkedin.com/in/george-smith')).toBe(
      'linkedin.com/in/george-smith',
    );
    expect(tidyUrl('  http://WWW.example.com/  ')).toBe('example.com');
    expect(tidyUrl('george.dev')).toBe('george.dev');
  });

  it('gives each link kind its own glyph and falls back to the chain', () => {
    expect(linkIcon('github')).toBe('code-branch');
    expect(linkIcon('linkedin')).toBe('id-badge');
    expect(linkIcon(undefined)).toBe('link');
  });

  it('labels a link by its own name over its tidied address', () => {
    const link: ProfileLink = {
      id: 'link_portfolio',
      label: 'Portfolio',
      url: 'https://georgesmith.design',
      kind: 'portfolio',
    };

    expect(linkRow(link)).toEqual({
      id: 'link_portfolio',
      tile: { kind: 'glyph', icon: 'palette' },
      title: 'Portfolio',
      subtitle: 'georgesmith.design',
    });
    // LinkedIn wears its own illustrated mark on the boards (577:9056).
    expect(linkRow({ ...link, kind: 'linkedin' }).tile).toEqual({ kind: 'linkedin' });
  });
});
