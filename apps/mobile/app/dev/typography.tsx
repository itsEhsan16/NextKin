import { StyleSheet, View } from 'react-native';

import { useTheme, type TypographyRole, type TypeRole } from '@/theme';
import { Screen, Text } from '@/ui';
import { DevSection } from '@/ui/dev';

const SAMPLE = 'The quick brown fox - NextKin 2026';

export default function TypographyRoute() {
  const { typography, colors, spacing } = useTheme();
  const roles = Object.entries(typography) as [TypographyRole, TypeRole][];

  return (
    <Screen scroll edges={[]}>
      <DevSection title="Type ramp" description={`${roles.length} roles · Plus Jakarta Sans`}>
        <View style={{ gap: spacing[5] }}>
          {roles.map(([name, role]) => (
            <View
              key={name}
              style={[
                styles.block,
                { gap: spacing[1], paddingBottom: spacing[4], borderBottomColor: colors.divider },
              ]}
            >
              <View style={styles.meta}>
                <Text variant="captionSemiBold" color="brand">
                  {name}
                </Text>
                <Text variant="captionRegular" color="textTertiary">
                  {role.fontSize}/{role.lineHeight}
                  {role.letterSpacing ? ` · ${role.letterSpacing}` : ''} ·{' '}
                  {shortFamily(role.fontFamily)}
                </Text>
              </View>
              <Text variant={name}>{SAMPLE}</Text>
            </View>
          ))}
        </View>
      </DevSection>
    </Screen>
  );
}

/** "PlusJakartaSans_600SemiBold" → "600" */
function shortFamily(family: string | undefined): string {
  if (!family) return '';
  const match = /_(\d{3})/.exec(family);
  return match?.[1] ?? family;
}

const styles = StyleSheet.create({
  block: { borderBottomWidth: StyleSheet.hairlineWidth },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
