import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockStore, resetMockRepos } from '@nextkin/shared/repos';

import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { recordValues } from '../../../testSupport/recordValues';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

/** Two saves in a row, then the refetch: more than Jest's 5s default leaves room for. */
const ROUND_TRIPS_MS = 15_000;

/** Resolves once the preferences and the app settings have loaded; returns Job preferences. */
const settle = () =>
  screen.findByRole('region', { name: 'Job preferences' }, { timeout: SETTLE_MS.normal * 2 });

const card = (name: string) => screen.getByRole('region', { name });

describe('SettingsScreen — Preferences (356:2)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it("renders the board's header, its cards and the column beside them", async () => {
    renderWithQuery(<SettingsScreen initialSection="preferences" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Preferences' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Customize your NextKin experience to match your goals, workflow, and style.',
      ),
    ).toBeInTheDocument();
    await settle();

    expect(card('App settings')).toBeInTheDocument();
    expect(card('Content & AI preferences')).toBeInTheDocument();

    const aside = screen.getByRole('complementary', { name: 'About preferences' });
    for (const text of [
      'Why set preferences?',
      'Get more relevant job recommendations',
      'Save time with a personalized experience',
      'Receive content that matches your goals',
      'Make NextKin work your way',
      '“A more personalized experience helps you discover the right opportunities, faster.”',
      '– The NextKin Team',
      'Need help?',
    ]) {
      expect(within(aside).getByText(text)).toBeInTheDocument();
    }
    expect(within(aside).getByRole('link', { name: 'Visit Help Center' })).toHaveAttribute(
      'href',
      '/help',
    );
  });

  it("shows George's job preferences, read-only until Edit", async () => {
    renderWithQuery(<SettingsScreen initialSection="preferences" />);
    const job = await settle();

    expect(within(job).getByRole('checkbox', { name: 'Full-time' })).toBeChecked();
    for (const name of ['Part-time', 'Contract', 'Internship']) {
      const box = within(job).getByRole('checkbox', { name });
      expect(box).not.toBeChecked();
      expect(box).toBeDisabled();
    }
    expect(within(job).getByRole('button', { name: 'Preferred work mode: Hybrid' })).toBeDisabled();

    const places = within(job).getByRole('list', { name: 'Preferred locations' });
    for (const place of ['Bengaluru, India', 'Remote', 'New York, USA']) {
      expect(within(places).getByText(place)).toBeInTheDocument();
    }
    const industries = within(job).getByRole('list', { name: 'Industries of interest' });
    for (const industry of ['Technology', 'Product', 'Design']) {
      expect(within(industries).getByText(industry)).toBeInTheDocument();
    }

    expect(within(job).getByRole('button', { name: 'Salary currency: INR (₹)' })).toBeDisabled();
    expect(within(job).getByRole('textbox', { name: 'Minimum salary amount' })).toHaveValue(
      '12,00,000',
    );
    expect(within(job).getByText('per year')).toBeInTheDocument();
  });

  it('unlocks the card with Edit, saves each change, and locks it again with Done', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SettingsScreen initialSection="preferences" />);
    const job = await settle();

    await user.click(within(job).getByRole('button', { name: 'Edit job preferences' }));
    const partTime = within(job).getByRole('checkbox', { name: 'Part-time' });
    expect(partTime).toBeEnabled();
    await user.click(partTime);
    expect(partTime).toBeChecked();

    await user.click(within(job).getByRole('button', { name: 'Remove Remote' }));
    const places = within(job).getByRole('list', { name: 'Preferred locations' });
    expect(within(places).queryByText('Remote')).not.toBeInTheDocument();

    await user.click(within(job).getByRole('button', { name: 'Preferred work mode: Hybrid' }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Remote' }));
    expect(
      await within(job).findByRole('button', { name: 'Preferred work mode: Remote' }),
    ).toBeInTheDocument();

    const amount = within(job).getByRole('textbox', { name: 'Minimum salary amount' });
    await user.clear(amount);
    await user.type(amount, '1500000');
    await user.tab();
    expect(amount).toHaveValue('15,00,000');

    await user.click(within(job).getByRole('button', { name: 'Done editing job preferences' }));
    expect(partTime).toBeDisabled();
    expect(partTime).toBeChecked();
  });

  it('saves the app settings and the switches at once, with light the only theme', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SettingsScreen initialSection="preferences" />);
    await settle();

    const app = card('App settings');
    expect(within(app).getByRole('radio', { name: 'Light' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    for (const name of ['Dark', 'System']) {
      expect(within(app).getByRole('radio', { name })).toBeDisabled();
    }
    expect(within(app).getByRole('button', { name: 'Language: English (US)' })).toBeEnabled();
    expect(
      within(app).getByRole('button', { name: 'Date format: DD MMM YYYY (e.g., 14 Jan 2024)' }),
    ).toBeInTheDocument();

    await user.click(
      within(app).getByRole('button', {
        name: 'Time zone: (GMT+05:30) India Standard Time - Bengaluru',
      }),
    );
    await user.click(
      await screen.findByRole('menuitemcheckbox', {
        name: '(GMT+01:00) Central European Time - Berlin',
      }),
    );
    expect(
      await within(app).findByRole('button', {
        name: 'Time zone: (GMT+01:00) Central European Time - Berlin',
      }),
    ).toBeInTheDocument();

    const ai = card('Content & AI preferences');
    expect(
      within(ai)
        .getAllByRole('switch')
        .map((toggle) => toggle.getAttribute('aria-checked')),
    ).toEqual(['true', 'false', 'true']);
    const experiments = within(ai).getByRole('switch', { name: 'Include experimental features' });
    await user.click(experiments);
    expect(experiments).toHaveAttribute('aria-checked', 'true');
  });

  it(
    'keeps two quick ticks in one list, and neither box unticks while the first saves',
    async () => {
      const user = userEvent.setup();
      renderWithQuery(<SettingsScreen initialSection="preferences" />);
      const job = await settle();
      await user.click(within(job).getByRole('button', { name: 'Edit job preferences' }));
      const contract = within(job).getByRole('checkbox', { name: 'Contract' }) as HTMLInputElement;
      const shown = recordValues(() => contract.checked);
      const saved = () => mockStore.state.profile.preferences.employmentTypes;

      // Both write the one list of job types, so the second save has to land after the first.
      await user.click(within(job).getByRole('checkbox', { name: 'Part-time' }));
      await user.click(contract);
      const both = ['full_time', 'part_time', 'contract'];
      await waitFor(() => expect(saved()).toEqual(both), { timeout: SETTLE_MS.normal * 4 });
      // Long enough for a late first save, and the refetch after the last, to land as well.
      await act(() => new Promise<void>((resolve) => setTimeout(resolve, SETTLE_MS.normal)));

      expect(saved()).toEqual(both);
      expect(shown.stop()).toEqual([false, true]);
    },
    ROUND_TRIPS_MS,
  );

  it(
    'keeps two quick switch flips, and neither flips back while the first saves',
    async () => {
      const user = userEvent.setup();
      renderWithQuery(<SettingsScreen initialSection="preferences" />);
      await settle();
      const ai = card('Content & AI preferences');
      const personalize = within(ai).getByRole('switch', {
        name: 'Personalize job recommendations',
      });
      const shown = recordValues(() => personalize.getAttribute('aria-checked'));
      const saved = () => {
        const { experimentalFeatures, personalizedRecommendations } = mockStore.state.appSettings;
        return [experimentalFeatures, personalizedRecommendations];
      };

      await user.click(within(ai).getByRole('switch', { name: 'Include experimental features' }));
      await user.click(personalize);
      await waitFor(() => expect(saved()).toEqual([true, false]), {
        timeout: SETTLE_MS.normal * 4,
      });
      await act(() => new Promise<void>((resolve) => setTimeout(resolve, SETTLE_MS.normal)));

      expect(saved()).toEqual([true, false]);
      expect(shown.stop()).toEqual(['true', 'false']);
    },
    ROUND_TRIPS_MS,
  );
});
