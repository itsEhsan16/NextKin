import { useCallback } from 'react';

import { useGuardedRouter } from '@/navigation';
import { useTheme } from '@/theme';
import { Sheet } from '@/ui/Sheet';

import { HomeMenuSheetBody, type HomeMenuDestination } from './components/HomeMenuSheetBody';
import { useHomeStore } from './homeStore';

/**
 * Mounts the hamburger menu once, above the tab bar and the FAB, beside the filters and
 * resume-menu hosts — the same z-order, so its scrim dims the chrome. Close-then-navigate: the
 * sheet's exit runs while the pushed screen arrives, rather than after it.
 */
export function HomeMenuHost() {
  const { sizes } = useTheme();
  const router = useGuardedRouter();
  const open = useHomeStore((state) => state.menuOpen);
  const closeMenu = useHomeStore((state) => state.closeMenu);

  const select = useCallback(
    (destination: HomeMenuDestination) => {
      closeMenu();
      switch (destination) {
        case 'history':
          router.push('/history');
          return;
        case 'interview':
          router.push('/interview');
          return;
        case 'assistant':
          router.push('/assistant');
          return;
        case 'upgrade':
          router.push('/upgrade');
          return;
        case 'help':
          router.push('/support/help');
          return;
        case 'contact':
          router.push('/support/contact');
          return;
      }
    },
    [closeMenu, router],
  );

  return (
    <Sheet open={open} onClose={closeMenu} height={sizes.sheetMenuHeight} accessibilityLabel="Menu">
      <HomeMenuSheetBody onSelect={select} onClose={closeMenu} />
    </Sheet>
  );
}
