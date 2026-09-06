import {
  addRoleSkill,
  blankExperience,
  certificationEntry,
  educationEntry,
  experienceEntry,
  linkEntry,
  looksLikeUrl,
  normaliseUrl,
  removeRoleSkill,
  sameDraft,
  validateCertification,
  validateEducation,
  validateExperience,
  validateLink,
  type CertificationDraft,
  type EducationDraft,
  type ExperienceDraft,
  type LinkDraft,
} from '@/features/profile/profileForms';

const role = (over: Partial<ExperienceDraft> = {}): ExperienceDraft => ({
  ...blankExperience(),
  company: 'Flipkart',
  title: 'Senior UX Designer',
  startDate: '2022-03-01',
  ...over,
});

const degree = (over: Partial<EducationDraft> = {}): EducationDraft => ({
  institution: 'National Institute of Design',
  degree: 'M.Des.',
  field: '',
  startDate: '2014-07-01',
  endDate: '2016-05-01',
  current: false,
  ...over,
});

const credential = (over: Partial<CertificationDraft> = {}): CertificationDraft => ({
  name: 'Certified Accessibility Specialist',
  issuer: 'IAAP',
  issuedOn: '2023-04-01',
  expiresOn: '',
  credentialUrl: '',
  ...over,
});

const link = (over: Partial<LinkDraft> = {}): LinkDraft => ({
  kind: 'portfolio',
  label: 'Portfolio',
  url: 'https://georgesmith.design',
  ...over,
});

/** The messages, not just the keys: "invalid" is exactly what these forms must never say. */
const errorsOf = (result: ReturnType<typeof validateExperience>): Record<string, string> =>
  result.ok ? {} : result.errors;

describe('profileForms — normaliseUrl (V2 §7.3)', () => {
  it('leaves an address that already carries a scheme alone', () => {
    expect(normaliseUrl('https://georgesmith.design')).toBe('https://georgesmith.design');
    // http is kept rather than upgraded: changing the scheme changes where it points.
    expect(normaliseUrl('http://georgesmith.design')).toBe('http://georgesmith.design');
    expect(normaliseUrl('HTTPS://Georgesmith.design')).toBe('HTTPS://Georgesmith.design');
  });

  it('puts https on a bare host, which is what people type', () => {
    expect(normaliseUrl('linkedin.com/in/george')).toBe('https://linkedin.com/in/george');
    expect(normaliseUrl('georgesmith.design')).toBe('https://georgesmith.design');
  });

  it('trims the whitespace a paste brings with it', () => {
    expect(normaliseUrl('  linkedin.com/in/george  ')).toBe('https://linkedin.com/in/george');
    expect(normaliseUrl('\n https://x.dev \t')).toBe('https://x.dev');
  });

  it('never invents an address out of nothing', () => {
    expect(normaliseUrl('')).toBe('');
    expect(normaliseUrl('   ')).toBe('');
  });

  it('does not double the slashes on a protocol-relative paste', () => {
    expect(normaliseUrl('//georgesmith.design/work')).toBe('https://georgesmith.design/work');
  });
});

describe('profileForms — looksLikeUrl', () => {
  it.each([
    'linkedin.com/in/george',
    'https://linkedin.com/in/george-smith',
    'georgesmith.design',
    'http://x.co',
    'sub.domain.example.com/a?b=c#d',
  ])('accepts %s', (value) => expect(looksLikeUrl(value)).toBe(true));

  it.each(['', '   ', 'georgesmith', 'george smith.design', 'https://', 'design.d'])(
    'refuses %s',
    (value) => expect(looksLikeUrl(value)).toBe(false),
  );
});

describe('profileForms — experience rules', () => {
  it('asks for the company and the title in words', () => {
    const errors = errorsOf(validateExperience(role({ company: '  ', title: '' })));
    expect(errors.company).toBe('Add the company name.');
    expect(errors.title).toBe('Add your job title.');
  });

  it('accepts a role with only a company and a title — the dates can come later', () => {
    expect(validateExperience(role({ startDate: '', endDate: '' })).ok).toBe(true);
  });

  it('refuses an end date before the start date', () => {
    const errors = errorsOf(validateExperience(role({ endDate: '2021-01-01' })));
    expect(errors.endDate).toBe('The end date is before the start date.');
  });

  it('has no end date to be wrong about while the role is current', () => {
    expect(validateExperience(role({ endDate: '2021-01-01', current: true })).ok).toBe(true);
  });

  it('sends a new role with an empty id and drops the end date of a current one', () => {
    const entry = experienceEntry(
      '',
      role({ company: '  Flipkart ', current: true, endDate: '2021-01-01' }),
    );
    expect(entry.id).toBe('');
    expect(entry.company).toBe('Flipkart');
    expect(entry).not.toHaveProperty('endDate');
  });
});

describe('profileForms — education rules', () => {
  it('names the two fields it needs', () => {
    const result = validateEducation(degree({ institution: '', degree: ' ' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.institution).toBe('Add the school or university.');
    expect(result.errors.degree).toBe('Add the qualification.');
  });

  it('refuses an end before a start unless the course is still running', () => {
    expect(validateEducation(degree({ endDate: '2013-01-01' })).ok).toBe(false);
    expect(validateEducation(degree({ endDate: '2013-01-01', current: true })).ok).toBe(true);
  });

  it('omits an empty field of study rather than storing a blank one', () => {
    expect(educationEntry('edu_1', degree())).not.toHaveProperty('field');
    expect(educationEntry('edu_1', degree({ field: ' Interaction Design ' })).field).toBe(
      'Interaction Design',
    );
  });
});

describe('profileForms — certification rules', () => {
  it('names the two fields it needs', () => {
    const result = validateCertification(credential({ name: '', issuer: '' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBe('Add the certification name.');
    expect(result.errors.issuer).toBe('Add who issued it.');
  });

  it('refuses an expiry before the issue date, and allows no expiry at all', () => {
    expect(validateCertification(credential({ expiresOn: '2022-04-01' })).ok).toBe(false);
    expect(validateCertification(credential({ expiresOn: '2026-04-01' })).ok).toBe(true);
    expect(validateCertification(credential({ expiresOn: '' })).ok).toBe(true);
  });

  it('checks the credential link only when there is one', () => {
    expect(validateCertification(credential({ credentialUrl: '' })).ok).toBe(true);
    const result = validateCertification(credential({ credentialUrl: 'not a link' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.credentialUrl).toBe("That doesn't look like a web address.");
  });

  it('stores the credential link normalised', () => {
    const entry = certificationEntry('', credential({ credentialUrl: 'iaap.org/verify/1' }));
    expect(entry.credentialUrl).toBe('https://iaap.org/verify/1');
    expect(certificationEntry('', credential())).not.toHaveProperty('credentialUrl');
  });
});

describe('profileForms — link rules', () => {
  it('needs a name and an address, and says which is missing', () => {
    const result = validateLink(link({ label: '', url: '' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.label).toBe('Add a name for this link.');
    expect(result.errors.url).toBe('Add the web address.');
  });

  it('refuses something that is not an address', () => {
    expect(validateLink(link({ url: 'my portfolio' })).ok).toBe(false);
  });

  it('normalises the address on the way out and keeps the kind', () => {
    const entry = linkEntry(
      '',
      link({ kind: 'linkedin', label: ' LinkedIn ', url: 'linkedin.com/in/george' }),
    );
    expect(entry).toEqual({
      id: '',
      kind: 'linkedin',
      label: 'LinkedIn',
      url: 'https://linkedin.com/in/george',
    });
  });
});

describe('profileForms — role skills', () => {
  it('refuses a blank and a duplicate out loud rather than dropping either', () => {
    expect(addRoleSkill(['Figma'], '  ')).toEqual({ refused: 'Type a skill first.' });
    expect(addRoleSkill(['Figma'], 'figma')).toEqual({ refused: 'figma is already on this role.' });
    expect(addRoleSkill(['Figma'], ' Mobile UX ')).toEqual({ skills: ['Figma', 'Mobile UX'] });
  });

  it('takes one out without touching the rest', () => {
    expect(removeRoleSkill(['Figma', 'Mobile UX'], 'Figma')).toEqual(['Mobile UX']);
  });
});

describe('profileForms — sameDraft', () => {
  it('reads a deep clone as unchanged', () => {
    const draft = role({ skills: ['Figma', 'Mobile UX'] });
    expect(sameDraft(draft, { ...draft, skills: [...draft.skills] })).toBe(true);
  });

  it('sees a changed field, a changed switch and a changed list', () => {
    const draft = role({ skills: ['Figma'] });
    expect(sameDraft(draft, { ...draft, company: 'Swiggy' })).toBe(false);
    expect(sameDraft(draft, { ...draft, current: true })).toBe(false);
    expect(sameDraft(draft, { ...draft, skills: [] })).toBe(false);
    expect(sameDraft(draft, { ...draft, skills: ['Figma', 'Mobile UX'] })).toBe(false);
  });

  it('sees a reordered list as a change — the order is what the profile stores', () => {
    const draft = role({ skills: ['Figma', 'Mobile UX'] });
    expect(sameDraft(draft, { ...draft, skills: ['Mobile UX', 'Figma'] })).toBe(false);
  });
});
