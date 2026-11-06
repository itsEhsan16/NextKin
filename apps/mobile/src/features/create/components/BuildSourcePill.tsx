import { View } from 'react-native';

import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import type { BuildFromSource } from './BuildSourceRows';

const shortLabel = (source: BuildFromSource): string =>
  source.kind === 'profile'
    ? 'Your profile'
    : source.kind === 'resume'
      ? source.resume.title
      : `Reading ${source.fileName}…`;

/**
 * What the resume is built from, as one tappable pill (§172): "From  Your profile ▾". Replaces
 * BUILD 01's pinned foot row; the same sheet opens on tap.
 */
export function BuildSourcePill({
  source,
  onPress,
}: {
  source: BuildFromSource;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      {...a11yButton(`Built from ${shortLabel(source)}. Change`)}
      feedback="subtle"
      haptic="light"
      onPress={onPress}
      style={[styles.pill, { backgroundColor: colors.surfaceCard, borderColor: colors.borderDefault }]}
    >
      <Icon
        name={source.kind === 'profile' ? 'User01' : 'File04'}
        size="sm"
        color={colors.brand}
      />
      <Text variant="footnote" color="textSecondary">
        From
      </Text>
      <View style={styles.label}>
        <Text variant="footnote" color="ink" numberOfLines={1}>
          {shortLabel(source)}
        </Text>
      </View>
      <Icon name="ChevronDown" size="sm" color={colors.iconDefault} />
    </Pressable>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(6),
    height: u(36),
    paddingHorizontal: u(12),
    borderRadius: u(999),
    borderWidth: 1,
    maxWidth: '100%',
  },
  label: { flexShrink: 1 },
}));
