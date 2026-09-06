import { useCallback } from 'react';

import { useTheme } from '@/theme';
import { Sheet } from '@/ui/Sheet';

import { LocationSheetBody } from './components/LocationSheetBody';
import { useJobsStore } from './jobsStore';

/**
 * The Discover header's location control (Figma JOBS 01, 1:289) opens this. Mounted once over
 * the tab bar beside the filters and sort sheets, so the three share a z-order and a scrim.
 *
 * The choice sets the LABEL and deliberately does not narrow the list, because that is what the
 * designed screen does. JOBS 01 draws this control reading "Bengaluru, India" over a list that
 * includes Zoho in Chennai and Linear at "Remote (India)", and the store seeds it the same way:
 * `location` is "Bengaluru, India" while `INITIAL_FILTERS.locations` is empty. The header names
 * where you are, not what you are filtered to.
 *
 * Making it filter for real is therefore a DESIGN change, not a wiring one — it would drop
 * Chennai and remote roles out of the seeded Discover list the artboard specifies. It would also
 * need `filters.locations` and the label written in one action so they cannot disagree, a
 * `locations` case in `appliedFilterChips` so the filter is removable, and `clearFilters`
 * resetting the label with it. Logged in `toreview.md` rather than guessed at.
 */
export function LocationSheetHost() {
  const { sizes } = useTheme();

  const open = useJobsStore((state) => state.locationOpen);
  const location = useJobsStore((state) => state.location);
  const closeLocation = useJobsStore((state) => state.closeLocation);
  const setLocation = useJobsStore((state) => state.setLocation);

  const handleSelect = useCallback(
    (next: string) => {
      setLocation(next);
      closeLocation();
    },
    [closeLocation, setLocation],
  );

  return (
    <Sheet
      open={open}
      onClose={closeLocation}
      height={sizes.sheetPickerHeight}
      // Gated on `open` the way ResumeMenuHost gates its rename step: the lift mounts
      // `useAnimatedKeyboard`, which takes the app off Android's `adjustResize` for as long as it
      // is mounted, so a closed sheet must never ask for it.
      avoidKeyboard={open}
      // The option list scrolls inside the sheet, and the dismiss pan would fight it. The ✕, the
      // scrim and Android back all still dismiss.
      swipeToDismiss={false}
      accessibilityLabel="Location"
    >
      <LocationSheetBody value={location} onSelect={handleSelect} onClose={closeLocation} />
    </Sheet>
  );
}
