import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { repos, resetMockRepos } from '@nextkin/shared/repos';

import { structureJd } from '@nextkin/shared/jobs/jdStructure';

import { JdPageScreen } from '@/features/jd/screens/JdPageScreen';
import { SAMPLE_JD } from '@/features/upload/uploadLibrary';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

/** A job description's own page (toreview §110): the 02b job page, for what a JD's reading found. */

const replace = jest.fn();
const push = jest.fn();
let editParam: string | null = null;
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => ({ get: (key: string) => (key === 'edit' ? editParam : null) }),
  usePathname: () => '/jd/x',
}));

jest.setTimeout(20_000);
const LOADED = { timeout: SETTLE_MS.normal + 2500 };

async function pastedJd() {
  return repos.jd.extract({ source: 'paste', text: SAMPLE_JD });
}

describe('JdPageScreen', () => {
  beforeEach(() => {
    resetMockRepos();
    replace.mockClear();
    editParam = null;
  });
  afterEach(() => jest.restoreAllMocks());

  it('shows the whole posting by its sections, and what it asks that nobody could have (§129)', async () => {
    const user = userEvent.setup();
    const draft = await repos.jd.extract({
      source: 'paste',
      text: [
        'Senior Frontend Engineer',
        'Acme Pay is hiring an engineer to build the checkout used by two million shoppers.',
        'About us:',
        'Acme Pay builds payment tools for small shops across Europe.',
        'Requirements',
        '- You have 20+ years of experience with React',
        '- Strong TypeScript',
        'What we offer',
        '- 30 days of paid leave',
        'Compensation',
        'The base salary is €70,000 – €85,000 per year.',
        'How to apply',
        'Send your resume and a short note.',
      ].join('\n'),
    });
    renderWithQuery(<JdPageScreen id={draft.id} />);

    const check = await screen.findByRole(
      'region',
      { name: 'Requirements to double-check' },
      LOADED,
    );
    expect(within(check).getByText('Asks for 20 years of React')).toBeInTheDocument();
    expect(within(check).getByText(/React was released in 2013/)).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Benefits' })).toBeInTheDocument();
    expect(screen.getByText('30 days of paid leave')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pay' })).toBeInTheDocument();
    expect(screen.getByText('€70,000 – €85,000 per year')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'About the company' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How to apply' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tailor my resume' }));
    expect(push).toHaveBeenCalledWith(`/jd/${draft.id}/tailor`);
  });

  it('moves on by itself when a reading still running lands (§131)', async () => {
    const draft = await pastedJd();
    const real = repos.jd.get.bind(repos.jd);
    let calls = 0;
    const get = jest.spyOn(repos.jd, 'get').mockImplementation(async (id) => {
      calls += 1;
      const read = await real(id);
      return calls === 1 ? { ...read, status: 'extracting' } : read;
    });
    renderWithQuery(<JdPageScreen id={draft.id} />);

    expect(await screen.findByText('Reading the job description…', {}, LOADED)).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Tailor my resume' }, { timeout: 8000 }),
    ).toBeInTheDocument();
    get.mockRestore();
  });

  it('shows what was read, with the tools for it and none of a listing’s extras', async () => {
    const draft = await pastedJd();
    renderWithQuery(<JdPageScreen id={draft.id} />);

    expect(
      await screen.findByRole('heading', { level: 1, name: draft.title }, LOADED),
    ).toBeInTheDocument();
    if (draft.responsibilities.length) {
      expect(screen.getByRole('heading', { name: 'Responsibilities' })).toBeInTheDocument();
    }
    const asks = screen.getByRole('region', { name: 'What this job asks for' });
    const required = within(asks).getByRole('list', { name: 'Required skills' });
    for (const skill of draft.requiredSkills)
      expect(within(required).getByText(skill)).toBeInTheDocument();
    // Read-only (toreview §110.5): skills are added in tailoring, after the comparison.
    expect(within(asks).queryByRole('button')).not.toBeInTheDocument();

    // A JD has no posting date, applicants, save, benefits, company card or similar jobs.
    expect(screen.queryByText(/^Posted /)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Company' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Similar jobs' })).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Back to Upload a JD' })).toHaveAttribute(
      'href',
      '/upload-jd',
    );
  });

  it('opens this JD’s own tailoring straight away, the resume picked there (toreview §114)', async () => {
    const user = userEvent.setup();
    const draft = await pastedJd();
    renderWithQuery(<JdPageScreen id={draft.id} />);
    await user.click(await screen.findByRole('button', { name: /Tailor your resume/ }, LOADED));
    expect(push).toHaveBeenCalledWith(`/jd/${draft.id}/tailor`);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the original text beside what was read (V2 §7.5)', async () => {
    const user = userEvent.setup();
    const draft = await pastedJd();
    renderWithQuery(<JdPageScreen id={draft.id} />);

    const toggle = await screen.findByRole('button', { name: 'Show' }, LOADED);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Senior Product Designer/, { selector: 'div' })).toBeInTheDocument();
  });

  it('a read job has no "Edit details": NextKin owns the reading (owner, toreview §153)', async () => {
    const draft = await pastedJd();
    renderWithQuery(<JdPageScreen id={draft.id} />);
    expect(await screen.findByRole('button', { name: /Tailor my resume/ }, LOADED)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Edit details/ })).not.toBeInTheDocument();
  });

  it('entering the details by hand (a job that couldn’t be read) saves what the user types', async () => {
    const user = userEvent.setup();
    editParam = '1';
    const draft = await pastedJd();
    renderWithQuery(<JdPageScreen id={draft.id} />);

    // W-FLOW 06: the edit is its own page, the original text beside the form.
    expect(await screen.findByRole('heading', { level: 1, name: 'Edit details' })).toBeVisible();
    expect(screen.getByText('Pasted job description')).toBeInTheDocument();
    const form = screen.getByRole('form', { name: 'Edit the job’s details' });
    const title = within(form).getByRole('textbox', { name: 'Job title' });
    await user.clear(title);
    await user.type(title, 'Staff Product Designer');
    const company = within(form).getByRole('textbox', { name: 'Company' });
    await user.clear(company);
    await user.type(company, 'Acme');

    const required = draft.requiredSkills[0];
    if (required) {
      // A skill moves from must-have to nice to have with one press.
      await user.click(
        within(form).getByRole('button', { name: `Move to nice to have: ${required}` }),
      );
      expect(
        within(within(form).getByRole('list', { name: 'Nice to have' })).getByText(required),
      ).toBeInTheDocument();
    }
    await user.type(
      within(form).getByRole('textbox', { name: 'Must-have skills: add one' }),
      'Accessibility{Enter}',
    );
    await user.click(within(form).getByRole('button', { name: /Add a responsibility/ }));
    const duties = within(form).getAllByRole('textbox', { name: /^Responsibility \d+$/ });
    await user.type(duties[duties.length - 1]!, 'Run design reviews');

    // "Save changes" sits in the header and submits the form through its `form` attribute.
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByRole('heading', { level: 1, name: 'Staff Product Designer' }, LOADED);
    const saved = await repos.jd.get(draft.id);
    expect(saved.title).toBe('Staff Product Designer');
    expect(saved.company).toBe('Acme');
    expect(saved.requiredSkills).toContain('Accessibility');
    expect(saved.responsibilities).toContain('Run design reviews');
    if (required) {
      expect(saved.preferredSkills).toContain(required);
      expect(saved.requiredSkills).not.toContain(required);
    }
  });

  it('opens on the review when the link says so', async () => {
    editParam = '1';
    const draft = await pastedJd();
    renderWithQuery(<JdPageScreen id={draft.id} />);

    expect(
      await screen.findByRole('form', { name: 'Edit the job’s details' }, LOADED),
    ).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }));
    expect(replace).toHaveBeenCalledWith(`/jd/${draft.id}`, { scroll: false });
  });

  it('shows a structured job by its facts and sections, flags what is unclear, never a run-on paragraph (§153)', async () => {
    const user = userEvent.setup();
    const raw = [
      'Full-stack Developer',
      'Clearcred Technology Private Limited Pulikeshi Nagar ₹45,000 - ₹80,000 monthly Fixed ₹45,000 - ₹80,000 Earning Potential ₹80,000 Work from Office Min. 1 year 5 working days Apply for job Share 95 applicants',
      'Build secure REST APIs for clients, merchants and partner banks.',
      'Must know React and Node.js.',
    ].join('\n');
    const said = (quote: string) => ({ text: quote, quote });
    const s = structureJd(
      raw,
      {
        title: said('Full-stack Developer'),
        company: said('Clearcred Technology Private Limited'),
        department: null,
        industry: null,
        employmentType: null,
        seniority: null,
        openings: null,
        referenceId: null,
        summary: 'A full-stack role building payment APIs for merchants and banks.',
        locations: [{ ...said('Pulikeshi Nagar'), city: null, region: null, country: null }],
        workModes: [{ value: 'onsite', quote: 'Work from Office' }],
        schedule: [{ kind: 'days', ...said('5 working days') }],
        pay: [
          { component: 'unknown', quote: '₹45,000 - ₹80,000 monthly' },
          { component: 'fixed', quote: 'Fixed ₹45,000 - ₹80,000' },
          { component: 'total', quote: 'Earning Potential ₹80,000' },
        ],
        negotiable: null,
        experience: [said('Min. 1 year')],
        responsibilities: [
          {
            ...said('Build secure REST APIs for clients, merchants and partner banks.'),
            group: null,
          },
        ],
        skills: [
          {
            name: 'React',
            quote: 'Must know React and Node.js',
            category: 'framework',
            importance: 'required',
          },
          {
            name: 'Node.js',
            quote: 'Must know React and Node.js',
            category: 'framework',
            importance: 'required',
          },
        ],
        education: [],
        languages: [],
        benefits: [],
        eligibility: [],
        companyAbout: [],
        website: null,
        application: [],
        extras: [],
        issues: [],
      },
      { today: '2026-11-03' },
    );
    const draft = await pastedJd();
    jest
      .spyOn(repos.jd, 'get')
      .mockResolvedValue({ ...draft, rawText: raw, title: 'Full-stack Developer', structured: s });
    renderWithQuery(<JdPageScreen id={draft.id} />);

    const facts = await screen.findByLabelText('Key facts', undefined, LOADED);
    expect(within(facts).getByText('₹45,000–₹80,000 a month')).toBeInTheDocument();
    expect(within(facts).getByText('Unclear in the listing')).toBeInTheDocument();
    expect(within(facts).getByText('1 year+')).toBeInTheDocument();
    expect(within(facts).getByText('On-site')).toBeInTheDocument();
    expect(within(facts).getByText('5 days a week')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Worth knowing' })).toBeInTheDocument();
    expect(screen.getByText('Summary written by NextKin from the listing.')).toBeInTheDocument();
    // The chrome of the page it was copied from is not shown as the job's description.
    expect(screen.queryByText(/95 applicants/, { selector: 'p' })).not.toBeInTheDocument();
    // Where the salary came from is one press away.
    await user.click(screen.getByRole('button', { name: 'Show where the listing says salary' }));
    expect(within(facts).getByText('“Fixed ₹45,000 - ₹80,000”')).toBeVisible();
    expect(screen.getByRole('list', { name: 'Frameworks' })).toHaveTextContent('React');
  });

  it('says so when the JD is gone', async () => {
    renderWithQuery(<JdPageScreen id="jd_missing" />);
    expect(
      await screen.findByText('We couldn’t find that job description', {}, LOADED),
    ).toBeInTheDocument();
  });
});
