'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Where keyboard focus goes back to when an admin dialog or drawer closes.
 *
 * Radix returns focus to the element that had it when the dialog opened. Most admin dialogs open
 * from a row's ⋮ menu, and by the time the dialog closes that menu item is gone, so focus fell to
 * `<body>` and a keyboard user had to start the page again (toreview §171.10). This remembers the
 * menu's trigger instead, the ⋮ button still on the row, and hands focus back to it.
 *
 * Pass the dialog's `open`; spread the result as the content's `onCloseAutoFocus`.
 */
export function useReturnFocus(open: boolean) {
  const target = useRef<HTMLElement | null>(null);

  // A layout effect runs before Radix's focus scope moves focus into the dialog.
  useLayoutEffect(() => {
    if (!open) return;
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body) return;
    const inMenu = active.closest('[role="menu"]');
    const menuTrigger = inMenu
      ? document.querySelector<HTMLElement>('[aria-haspopup="menu"][data-state="open"]')
      : null;
    target.current = menuTrigger ?? active;
  }, [open]);

  return useCallback((event: Event) => {
    const element = target.current;
    target.current = null;
    if (element?.isConnected) {
      event.preventDefault();
      element.focus();
    }
  }, []);
}
