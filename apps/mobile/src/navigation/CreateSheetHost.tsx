import { View } from 'react-native';

import { useLayoutScale, useTheme } from '@/theme';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

import { useCreateSheet } from './createSheet';

/**
 * Mounts the global "+" sheet once, above the tab navigator and below the FAB.
 * Body is a placeholder until the CREATE 01 / CREATE 02 artboards are implemented —
 * the spring, scrim, swipe-down and FAB sync are already the final behaviour.
 */
export function CreateSheetHost() {
  const { isOpen, close, progress } = useCreateSheet();
  const { sizes, spacing } = useTheme();
  const { s } = useLayoutScale();

  return (
    <Sheet
      open={isOpen}
      onClose={close}
      height={s(sizes.sheetStep1Height, 420)}
      progress={progress}
      accessibilityLabel="Create"
      contentStyle={{ paddingHorizontal: spacing.gutter, paddingTop: spacing[5], gap: spacing[2] }}
    >
      <Text variant="headline">Create</Text>
      <Text variant="body" color="textSecondary">
        Actions land with the CREATE 01 / CREATE 02 screens.
      </Text>
      <View style={{ flex: 1 }} />
    </Sheet>
  );
}
