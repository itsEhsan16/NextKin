import { screen, waitFor, within } from '@testing-library/react';

import { resetMockRepos } from '@nextkin/shared/repos';

import { DocumentViewerScreen } from '@/features/documents/screens/DocumentViewerScreen';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

const wait = { timeout: SETTLE_MS.normal * 3 };

describe('DocumentViewerScreen (563:1377)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('sets the Google cover letter as a page, with its details beside it', async () => {
    renderWithQuery(<DocumentViewerScreen id="doc_cover_google" />);

    const letter = await screen.findByRole('article', { name: 'Google cover letter' }, wait);
    for (const text of [
      'Software Engineer',
      'george.smith@gmail.com',
      'Re: Lead UX Designer (GOO-UX-10234)',
      'Dear Hiring Manager,',
      'Sincerely,',
    ]) {
      expect(within(letter).getByText(text)).toBeInTheDocument();
    }
    expect(
      within(letter).getByText(/^I am writing to apply for the Lead UX Designer role/),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Cover Letter - Google' }),
    ).toBeInTheDocument();
    const details = screen.getByRole('region', { name: 'Cover Letter - Google details' });
    const tags = within(details).getByRole('list', { name: 'Tags' });
    for (const tag of ['Cover Letter', 'Lead UX Designer', 'Google']) {
      expect(within(tags).getByText(tag)).toBeInTheDocument();
    }
    expect(within(details).getByText('245 KB')).toBeInTheDocument();
    expect(within(details).getByText('Google, Bengaluru')).toBeInTheDocument();
    expect(within(details).getByText('Lead UX Designer (GOO-UX-10234)')).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: /Use this document in your applications/ }),
    ).toHaveAttribute('href', expect.stringMatching(/^\/jobs/));
    const others = screen.getByRole('region', { name: 'Other cover letters' });
    expect(within(others).getByRole('link', { name: /Cover Letter - CRED/ })).toHaveAttribute(
      'href',
      '/documents/doc_cover_cred',
    );
    expect(within(others).getByRole('link', { name: /Cover Letter - Zoho/ })).toBeInTheDocument();
  });

  it('draws a certificate, and says when a file has no preview', async () => {
    const { unmount } = renderWithQuery(<DocumentViewerScreen id="doc_swe_certificate" />);
    expect(await screen.findByText('Google Career Certificates', {}, wait)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Other certificates' })).toBeInTheDocument();
    unmount();

    renderWithQuery(<DocumentViewerScreen id="doc_passport" />);
    expect(await screen.findByText('No preview for this file', {}, wait)).toBeInTheDocument();
  });

  it('says so when the document does not exist', async () => {
    renderWithQuery(<DocumentViewerScreen id="doc_nope" />);
    expect(await screen.findByText('Document not found', {}, wait)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Documents' })).toHaveAttribute(
      'href',
      '/documents',
    );
  });

  it('opens the letter’s own job, and says the file actions are coming', async () => {
    renderWithQuery(<DocumentViewerScreen id="doc_cover_google" />);
    await screen.findByRole('article', { name: 'Google cover letter' }, wait);
    const callout = screen.getByRole('link', { name: /Use this document in your applications/ });
    await waitFor(() => expect(callout).toHaveAttribute('href', '/jobs?job=job_google'), wait);
    expect(screen.getByRole('button', { name: 'More actions' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
