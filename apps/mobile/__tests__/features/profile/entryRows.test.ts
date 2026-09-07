import type { Certification, Education, Experience, ProfileLink } from '@/data/models';
import {
  certificationExpired,
  certificationRow,
  educationRow,
  experienceRow,
  linkIcon,
  linkRow,
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

describe('entryRows (V2 §7.3 row copy)', () => {
  it('reads a current role as Present and a finished one as its end month', () => {
    expect(experienceRow(experience)).toEqual({
      id: 'exp_1',
      icon: 'briefcase',
      title: 'Senior UX Designer',
      meta: 'Flipkart · Mar 2022 – Present',
    });

    expect(
      experienceRow({
        ...experience,
        company: 'Swiggy',
        current: false,
        startDate: '2019-06-01',
        endDate: '2022-02-28',
      }).meta,
    ).toBe('Swiggy · Jun 2019 – Feb 2022');
  });

  it('drops a date the picker never wrote instead of printing an unparseable one', () => {
    expect(experienceRow({ ...experience, current: false, startDate: '' }).meta).toBe('Flipkart');
  });

  it('labels education by its degree and dates it from the institution', () => {
    expect(educationRow(education)).toEqual({
      id: 'edu_1',
      icon: 'graduation-cap',
      title: 'M.Des.',
      meta: 'National Institute of Design · Jul 2014 – May 2016',
    });
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
      icon: 'certificate',
      title: 'Certified Usability Analyst',
      meta: 'HFI · 2021',
    });

    expect(certificationRow({ ...certification, issuedOn: undefined }, NOW).meta).toBe('HFI');
  });

  it('says so when a credential has lapsed, and stays quiet while it has not', () => {
    const lapsed = { ...certification, expiresOn: '2024-04-12' };
    const live = { ...certification, expiresOn: '2027-04-12' };

    expect(certificationExpired(lapsed, NOW)).toBe(true);
    expect(certificationExpired(live, NOW)).toBe(false);
    expect(certificationExpired(certification, NOW)).toBe(false);

    expect(certificationRow(lapsed, NOW).meta).toBe('HFI · 2021 · Expired');
    expect(certificationRow(live, NOW).meta).toBe('HFI · 2021');
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
    expect(linkIcon('github')).toBe('code');
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
      icon: 'palette',
      title: 'Portfolio',
      meta: 'georgesmith.design',
    });
  });
});
