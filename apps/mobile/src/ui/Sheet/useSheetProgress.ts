/**
 * The Sheet's open/close drive, split out of Sheet.tsx to keep it under the size guideline.
 *
 * Opening springs `progress` to 1 (with the keyboard taken down for a sheet
 * with no field of its own). Closing eases it to 0 and then unmounts. A close that starts from a
 * partly dragged sheet takes only the share of the close time the remaining distance needs, so a
 * swipe let go most of the way down does not then crawl the last stretch at full length.
 */
import { useEffect } from 'react';
import { Keyboard } from 'react-native';
import { runOnJS, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

import { withReducedMotion } from '@/lib';
import type { Theme } from '@/theme';

import { closeDuration } from './sheetDismissMath';

export type SheetProgressInput = {
  open: boolean;
  progress: SharedValue<number>;
  reduced: boolean;
  avoidKeyboard: boolean;
  motion: Theme['motion'];
  /** Called once the close has finished on screen. */
  onClosed: () => void;
};

export function useSheetProgress({
  open,
  progress,
  reduced,
  avoidKeyboard,
  motion,
  onClosed,
}: SheetProgressInput): void {
  useEffect(() => {
    if (open) {
      // A sheet with no field of its own takes the keyboard down with it on the way up. Tapping
      // a date row straight from a focused text field otherwise opened both at once, and the
      // keyboard — which the OS draws above everything in the React tree — buried the sheet.
      // Sheets that DO carry a field (`avoidKeyboard`) are left alone: they raise their own.
      if (!avoidKeyboard) Keyboard.dismiss();
      progress.set(withSpring(1, withReducedMotion(reduced, motion.springs.sheetIn)));
      return;
    }
    const duration = closeDuration(progress.get(), {
      min: motion.durations.press,
      max: motion.timings.sheetOut.duration,
    });
    progress.set(
      withTiming(
        0,
        withReducedMotion(reduced, { ...motion.timings.sheetOut, duration }),
        (finished) => {
          if (finished) runOnJS(onClosed)();
        },
      ),
    );
  }, [avoidKeyboard, motion, onClosed, open, progress, reduced]);
}
