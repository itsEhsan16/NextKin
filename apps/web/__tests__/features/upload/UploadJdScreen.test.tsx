import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { repos, resetMockRepos } from '@nextkin/shared/repos';

import { looksLikeLink } from '@/features/upload/components/JobInput';
import { UploadJdScreen } from '@/features/upload/screens/UploadJdScreen';
import { SAMPLE_JD } from '@/features/upload/uploadLibrary';
import { renderWithQuery } from '../../../testSupport/render';

/**
 * Add a job (toreview §114, owner 2026-10-19): one box for the description, its link or a file.
 * Since §129 (owner 2026-10-21) Analyze opens the JD's own page, shown as a job, and the user
 * tailors from there; Home's Build Resume still opens the build screen straight away.
 */

/** Extraction has its own latency band, 1.2-2.2s (`jdRepo`), longer than the default settle. */
const EXTRACTED = { timeout: 4000 };
const SLOW_TEST = 15_000;

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/upload-jd',
}));

const JD_PAGE = /^\/jd\/([^/?]+)$/;

async function openedDraft() {
  await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringMatching(JD_PAGE)), EXTRACTED);
  const href = push.mock.calls.at(-1)![0] as string;
  return repos.jd.get(decodeURIComponent(JD_PAGE.exec(href)![1]!));
}

describe('UploadJdScreen', () => {
  beforeEach(() => {
    resetMockRepos();
    push.mockClear();
  });

  it('is one box with one button, no tabs', () => {
    renderWithQuery(<UploadJdScreen />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Tailor your resume to a job' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Job description or link' })).toBeInTheDocument();
    expect(screen.getByText('0/10,000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tailor my resume' })).toBeDisabled();
  });

  it(
    'reads pasted text and opens its job page',
    async () => {
      const user = userEvent.setup();
      renderWithQuery(<UploadJdScreen />);
      await user.click(screen.getByRole('textbox', { name: 'Job description or link' }));
      await user.paste('Product Designer at Swiggy\n- Ship prototypes in Figma');
      await user.click(screen.getByRole('button', { name: 'Tailor my resume' }));
      expect(screen.getByText('Reading the job description…')).toBeInTheDocument();
      const draft = await openedDraft();
      expect(draft).toMatchObject({ title: 'Product Designer at Swiggy', company: 'Swiggy' });
      // Still busy while the next page opens: no flash of an idle form.
      expect(screen.getByRole('button', { name: 'Analyzing…' })).toBeDisabled();
    },
    SLOW_TEST,
  );

  it(
    'from Build Resume, opens the job on building a new resume (toreview §125)',
    async () => {
      const user = userEvent.setup();
      renderWithQuery(<UploadJdScreen intent="build" />);
      expect(screen.getByRole('heading', { name: 'Build a resume for a job' })).toBeInTheDocument();
      await user.click(screen.getByRole('textbox', { name: 'Job description or link' }));
      await user.paste('Product Designer at Swiggy\n- Ship prototypes in Figma');
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      await waitFor(
        () =>
          expect(push).toHaveBeenCalledWith(
            expect.stringMatching(/^\/jd\/.+\/tailor\?mode=build$/),
          ),
        EXTRACTED,
      );
    },
    SLOW_TEST,
  );

  it('fills a sample job on request', async () => {
    const user = userEvent.setup();
    renderWithQuery(<UploadJdScreen />);
    await user.click(screen.getByRole('button', { name: 'Try a sample job' }));
    expect(screen.getByRole('textbox', { name: 'Job description or link' })).toHaveValue(SAMPLE_JD);
  });

  it(
    'treats a lone link as a link, and a file dropped in as the job',
    async () => {
      const user = userEvent.setup();
      renderWithQuery(<UploadJdScreen />);
      await user.click(screen.getByRole('textbox', { name: 'Job description or link' }));
      await user.paste('https://www.linkedin.com/jobs/view/4012345678');
      // The mock reads links (a demo); against the server the box asks for the text instead.
      expect(screen.getByRole('button', { name: 'Read the posting' })).toBeEnabled();
      await user.clear(screen.getByRole('textbox', { name: 'Job description or link' }));

      const file = new File(['x'.repeat(2048)], 'Senior Product Designer - Google.pdf', {
        type: 'application/pdf',
      });
      await user.upload(screen.getByLabelText('Job description file'), file);
      expect(screen.getByText('Senior Product Designer - Google.pdf')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Upload & tailor my resume' }));
      await openedDraft();
    },
    SLOW_TEST,
  );

  it('refuses a file it cannot read, before sending it', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderWithQuery(<UploadJdScreen />);
    await user.upload(
      screen.getByLabelText('Job description file'),
      new File(['x'], 'photo.png', { type: 'image/png' }),
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tailor my resume' })).toBeDisabled();
  });
});

describe('looksLikeLink', () => {
  it('is a single http(s) URL and nothing else', () => {
    expect(looksLikeLink(' https://jobs.example.com/123 ')).toBe(true);
    expect(looksLikeLink('See https://jobs.example.com/123 for details')).toBe(false);
    expect(looksLikeLink('jobs.example.com')).toBe(false);
  });
});
