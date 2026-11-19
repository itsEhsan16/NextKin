import { Platform } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Every text input's cursor, highlight and handles (owner, 2026-11-19, toreview §243).
 *
 * Android paints `selectionColor` as the highlight at full strength, so the old ink value hid the
 * selected words under a black block. There the highlight is a light brand tint and the handles
 * are brand. iOS fades `selectionColor` itself and uses it for the caret too, so it stays solid.
 * Spread this on a `TextInput`; never set these props by hand (a guard test checks).
 */
export function useSelectionColors() {
  const { colors } = useTheme();
  return Platform.OS === 'android'
    ? {
        selectionColor: colors.textSelection,
        selectionHandleColor: colors.brand,
        cursorColor: colors.textPrimary,
      }
    : { selectionColor: colors.brand, cursorColor: colors.textPrimary };
}
