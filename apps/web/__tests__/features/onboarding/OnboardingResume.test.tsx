import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import type { MockMode } from '@nextkin/shared/mock';
import { repos, resetMockRepos } from '@nextkin/shared/repos';

import { useOnboardingStore } from '@/features/onboarding/onboardingStore';
import { ResumeStepScreen } from '@/features/onboarding/screens/ResumeStepScreen';
import { UploadStepScreen } from '@/features/onboarding/screens/UploadStepScreen';
import { continueButton, renderInFrame, row, wait } from '../../../testSupport/onboarding';

/** Web onboarding ONB 04 and 04b: the resume question and the upload (807:215, 808:2; `toreview.md` §107.2). */

const push = jest.fn();
let pathname = '/onboarding/resume';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

jest.setTimeout(20_000);

function renderStep(path: string, ui: ReactElement, mode?: MockMode) {
  pathname = path;
  return renderInFrame(ui, mode);
}

describe('Web onboarding · resume', () => {
  beforeEach(() => {
    resetMockRepos();
    useOnboardingStore.getState().reset();
    push.mockClear();
  });

  describe('ONB 04 · resume', () => {
    it('needs a choice, keeps the Resume row pending, and goes on to the quick questions', async () => {
      const user = userEvent.setup();
      renderStep('/onboarding/resume', <ResumeStepScreen />);

      expect(screen.getByText('Step 4 of 4')).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { name: 'Onboarding progress' })).toHaveAttribute(
        'aria-valuenow',
        '100',
      );
      expect(continueButton()).toBeDisabled();

      await user.click(screen.getByText('No, help me make one'));
      expect(screen.getByRole('radio', { name: /No, help me make one/ })).toBeChecked();
      expect(
        within(row('Resume')).getByRole('img', { name: 'Not answered yet' }),
      ).toBeInTheDocument();

      await user.click(continueButton());
      expect(push).toHaveBeenCalledWith('/onboarding/work');
    });

    it('goes on to the upload when the answer is yes', async () => {
      const user = userEvent.setup();
      renderStep('/onboarding/resume', <ResumeStepScreen />);
      await user.click(screen.getByText('Yes, I’ll upload it'));
      await user.click(continueButton());
      expect(push).toHaveBeenCalledWith('/onboarding/upload');
    });
  });

  describe('ONB 04b · upload', () => {
    const pdf = (name: string) => new File(['%PDF-1.4'], name, { type: 'application/pdf' });

    it('reads the file, says what it found, and fills the Resume row', async () => {
      const user = userEvent.setup();
      renderStep('/onboarding/upload', <UploadStepScreen />);

      expect(screen.getByText('Step 4 of 4')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Back/ })).toHaveAttribute(
        'href',
        '/onboarding/resume',
      );
      expect(
        screen.getByRole('heading', { level: 1, name: 'Drop your resume here' }),
      ).toBeInTheDocument();
      expect(screen.getByText('PDF or DOCX')).toBeInTheDocument();
      expect(continueButton()).toBeDisabled();

      await user.upload(screen.getByLabelText('Resume file'), pdf('George_Smith_CV.pdf'));
      expect(await screen.findByText('Reading your resume…')).toBeInTheDocument();
      expect(continueButton()).toBeDisabled();

      const summary = await screen.findByText(
        /^Read · \d+ roles? and \d+ skills? found$/,
        {},
        wait,
      );
      expect(summary).toBeInTheDocument();
      expect(within(row('Resume')).getByText('George_Smith_CV.pdf')).toBeInTheDocument();
      // The parse lands the resume in the library, but nothing reaches the profile yet (§7.4).
      expect((await repos.resumes.list()).some((r) => r.title === 'George_Smith_CV')).toBe(true);

      await user.click(continueButton());
      expect(push).toHaveBeenCalledWith('/onboarding/done');
    });

    it('turns away other file types and says when a file has no text', async () => {
      const user = userEvent.setup({ applyAccept: false });
      renderStep('/onboarding/upload', <UploadStepScreen />);
      const input = screen.getByLabelText('Resume file');

      await user.upload(input, new File(['x'], 'notes.txt', { type: 'text/plain' }));
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Upload your resume as a PDF or DOCX file.',
      );

      await user.upload(input, pdf('scan.pdf'));
      expect(await screen.findByText(/We couldn’t read this file/, {}, wait)).toBeInTheDocument();
      expect(continueButton()).toBeDisabled();
      expect(
        within(row('Resume')).getByRole('img', { name: 'Not answered yet' }),
      ).toBeInTheDocument();
    });
  });
});
