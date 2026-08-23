import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { a11yHeader } from '@/lib';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type DevSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

/** Titled block used by every dev gallery page. */
export function DevSection({ title, description, children }: DevSectionProps) {
  const { spacing, colors } = useTheme();

  return (
    <View style={{ marginTop: spacing[8], gap: spacing[3] }}>
      <View style={{ gap: spacing[1] }}>
        <Text {...a11yHeader()} variant="headline">
          {title}
        </Text>
        {description ? (
          <Text variant="captionRegular" color="textSecondary">
            {description}
          </Text>
        ) : null}
      </View>
      <View style={[styles.divider, { backgroundColor: colors.divider }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
});
