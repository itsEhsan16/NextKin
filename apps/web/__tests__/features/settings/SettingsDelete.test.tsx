import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { Toaster } from '@/ui/Toaster';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

const section = () => screen.getByRole('region', { name: 'Delete account' });
const deleteButton = () => screen.getByRole('button', { name: 'Delete my account' });

describe('SettingsScreen — Delete account (467:3)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it("draws the board's warning, losses and alternative", () => {
    renderWithQuery(<SettingsScreen initialSection="delete" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Delete account' })).toBeInTheDocument();
    expect(
      screen.getByText("We're sorry to see you go. Please read the information below carefully."),
    ).toBeInTheDocument();
    expect(within(section()).getByText('This action cannot be undone')).toBeInTheDocument();
    const losses = within(section()).getAllByRole('listitem');
    expect(losses.map((item) => item.querySelector('span > span')?.textContent)).toEqual([
      'Your profile information',
      'Your resumes',
      'Your applications',
      'Your insights and activity',
      'Settings and preferences',
      'Connected accounts',
    ]);
    expect(screen.getByRole('button', { name: 'Deactivate account' })).toBeInTheDocument();
  });

  it('wakes the red button only once DELETE is typed, then deletes', async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <>
        <SettingsScreen initialSection="delete" />
        <Toaster />
      </>,
    );

    expect(deleteButton()).toBeDisabled();
    const box = screen.getByRole('textbox', { name: 'Confirm deletion' });
    await user.type(box, 'delete');
    expect(deleteButton()).toBeDisabled();
    await user.clear(box);
    await user.type(box, 'DELETE');
    expect(deleteButton()).toBeEnabled();

    await user.click(deleteButton());
    expect(
      await screen.findByText(
        'Your account has been deleted.',
        {},
        { timeout: SETTLE_MS.normal * 2 },
      ),
    ).toBeInTheDocument();
    expect(box).toHaveValue('');
  });

  it('goes back to Account on Cancel', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SettingsScreen initialSection="delete" />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('tab', { name: 'Account', selected: true })).toBeInTheDocument();
  });
});
