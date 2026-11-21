import { fireEvent, render, screen, within } from '@testing-library/react';

import { LandingScreen } from '@/features/landing/LandingScreen';

// Lenis ships ESM only; smooth scrolling is off in this test anyway (matchMedia never matches).
jest.mock('lenis', () => jest.fn());

// jsdom's matchMedia (jest.setup.ts) never matches, so every GSAP animation and Lenis stay off:
// this renders the page exactly as a reduced-motion visitor (or a crawler) gets it.

describe('LandingScreen', () => {
  it('renders the board’s sections in their final state', () => {
    render(<LandingScreen />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Every resume, written honestly for the job you want.',
    );
    for (const id of ['top', 'how', 'proof', 'score', 'pricing', 'faq']) {
      expect(document.getElementById(id)).not.toBeNull();
    }
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('points the nav at in-page sections and the app’s sign-up', () => {
    render(<LandingScreen />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const href of ['#how', '#proof', '#pricing', '#faq']) {
      expect(nav.querySelector(`a[href="${href}"]`)).not.toBeNull();
    }
    expect(nav.querySelector('a[href="/sign-up"]')).not.toBeNull();
  });

  it('switches the Pro price between monthly and annual billing', () => {
    render(<LandingScreen />);
    const pricing = document.getElementById('pricing')!;
    expect(within(pricing).getByText('$19')).toBeInTheDocument();
    expect(within(pricing).getByText('Billed monthly. Cancel anytime.')).toBeInTheDocument();

    fireEvent.click(within(pricing).getByRole('radio', { name: /Annually/ }));
    expect(within(pricing).getByRole('radio', { name: /Annually/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(pricing).getByText('$109')).toBeInTheDocument();
    expect(within(pricing).getByText('per year')).toBeInTheDocument();
    expect(
      within(pricing).getByText('About $9.08/mo, billed yearly. Cancel anytime.'),
    ).toBeInTheDocument();
    expect(within(pricing).queryByText('$19')).toBeNull();

    fireEvent.click(within(pricing).getByRole('radio', { name: 'Monthly' }));
    expect(within(pricing).getByText('$19')).toBeInTheDocument();
  });

  it('marks itself a public page, so a background 401 never sends a visitor to sign-in', () => {
    // On nextkin.ai the landing page sits at `/`, which the sign-in redirect can't tell from the
    // app's Home by path alone (src/lib/dataSource.ts).
    render(<LandingScreen />);
    expect(document.querySelector('[data-public-page]')).not.toBeNull();
  });

  it('labels the job-link field', () => {
    render(<LandingScreen />);
    expect(screen.getByLabelText('Job link')).toBeInTheDocument();
  });
});
