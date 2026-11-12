import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { HelpScreen } from '@/features/help/screens/HelpScreen';
import { Toaster } from '@/ui/Toaster';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

/** Resolves once the answers have loaded. */
const settle = () =>
  screen.findByRole('region', { name: 'Getting started' }, { timeout: SETTLE_MS.normal * 2 });

const question = (name: string) => screen.getByRole('button', { name });

describe('HelpScreen (563:4)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('draws the five topics with their answers, the score answer open as drawn', async () => {
    renderWithQuery(<HelpScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'How can we help?' })).toBeInTheDocument();
    await settle();

    expect(screen.getByText('14 answers')).toBeInTheDocument();
    for (const [topic, count] of [
      ['Getting started', '3 answers'],
      ['Resumes', '5 answers'],
      ['Jobs', '2 answers'],
      ['Billing', '2 answers'],
      ['Account', '2 answers'],
    ] as const) {
      expect(
        within(screen.getByRole('region', { name: topic })).getByText(count),
      ).toBeInTheDocument();
    }
    expect(question('What does the ATS score actually measure?')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText(/^It measures your document against NextKin's own/)).toBeVisible();
  });

  it('opens one answer at a time, in the web wording where the board gives one', async () => {
    const user = userEvent.setup();
    renderWithQuery(<HelpScreen />);
    await settle();

    await user.click(question('Can I get a copy of my data, or delete it?'));
    expect(question('What does the ATS score actually measure?')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    // 563:921: web points at Settings, not the phone's Profile tab.
    expect(screen.getByText(/^Both, in Settings\. Privacy & data builds an archive/)).toBeVisible();
  });

  it('filters by topic and searches the answers too', async () => {
    const user = userEvent.setup();
    renderWithQuery(<HelpScreen />);
    await settle();

    await user.click(screen.getByRole('tab', { name: /^Billing/ }));
    expect(screen.queryByRole('region', { name: 'Resumes' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Billing' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^All/ }));
    await user.type(screen.getByRole('searchbox', { name: 'Search help' }), 'watermark');
    // "never watermarked" is in the export answer, not its question.
    expect(question('Which formats can I download?')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Jobs' })).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Search help' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search help' }), 'zzzz');
    expect(screen.getByText('No answers match')).toBeInTheDocument();
  });

  it('says why an empty message cannot go, then sends one', async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <>
        <HelpScreen />
        <Toaster />
      </>,
    );
    await settle();

    // A labelled read-only field (HP-05).
    expect(await screen.findByDisplayValue('george.smith@gmail.com')).toHaveAccessibleName(
      'Reply goes to',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('Write a message first.')).toBeInTheDocument();

    const box = screen.getByRole('textbox', { name: 'Your message' });
    await user.type(box, 'The export button does nothing.');
    expect(screen.getByText('31 / 2000')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(
      await screen.findByText(
        'Message sent. We reply within 2 business days.',
        {},
        { timeout: SETTLE_MS.normal * 2 },
      ),
    ).toBeInTheDocument();
    expect(box).toHaveValue('');
  });

  it('shows both legal documents with when they last changed', async () => {
    renderWithQuery(<HelpScreen />);
    expect(
      await screen.findByRole(
        'link',
        { name: /^Terms of service Last updated/ },
        { timeout: SETTLE_MS.normal * 2 },
      ),
    ).toHaveAttribute('target', '_blank');
    expect(
      await screen.findByRole(
        'link',
        { name: /^Privacy policy Last updated/ },
        { timeout: SETTLE_MS.normal * 2 },
      ),
    ).toBeInTheDocument();
  });
});
