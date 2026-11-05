import { act, render } from '@testing-library/react';
import { createRef } from 'react';

import { AdminIcon, type AdminIconHandle } from '@/ui/animated/AdminIcon';
import { ADMIN_ICONS, type AdminIconName } from '@/ui/animated/iconMap';

describe('AdminIcon', () => {
  it.each(Object.keys(ADMIN_ICONS) as AdminIconName[])(
    'renders %s, hidden from assistive tech',
    (name) => {
      const { container } = render(<AdminIcon name={name} />);
      const root = container.firstElementChild;
      expect(root).not.toBeNull();
      expect(root).toHaveAttribute('aria-hidden');
    },
  );

  it('plays and stops from its ref, from either source', () => {
    const lucide = createRef<AdminIconHandle>();
    const lottie = createRef<AdminIconHandle>();
    render(
      <>
        <AdminIcon ref={lucide} name="Users01" />
        <AdminIcon ref={lottie} name="Database01" />
      </>,
    );
    expect(() =>
      act(() => {
        lucide.current?.start();
        lottie.current?.start();
        lucide.current?.stop();
        lottie.current?.stop();
      }),
    ).not.toThrow();
  });
});
