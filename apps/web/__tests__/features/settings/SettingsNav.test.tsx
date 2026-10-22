import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SettingsNav } from '@/features/settings/components/SettingsNav';
import { SETTINGS_SECTION_ORDER } from '@/features/settings/settingsLibrary';

describe('SettingsNav', () => {
  it('glides its wash to the section it is given, and reports clicks', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { container, rerender } = render(<SettingsNav active="account" onChange={onChange} />);
    const wash = () => container.querySelector<HTMLElement>('[data-highlight]');

    expect(wash()).toHaveAttribute('data-visible', 'true');
    expect(wash()?.style.getPropertyValue('--slide-index')).toBe('0');

    await user.click(screen.getByRole('tab', { name: 'Security' }));
    expect(onChange).toHaveBeenCalledWith('security');

    rerender(<SettingsNav active="security" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'Security', selected: true })).toBeInTheDocument();
    expect(wash()?.style.getPropertyValue('--slide-index')).toBe(
      String(SETTINGS_SECTION_ORDER.indexOf('security')),
    );
  });
});
