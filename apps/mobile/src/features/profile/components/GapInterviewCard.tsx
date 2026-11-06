import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useGapQuestions } from '@/data/queries';
import { pluralize } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';

import { ProfileCard } from './cards';

export type GapInterviewCardProps = { onOpen: () => void; style?: StyleProp<ViewStyle> };

/**
 * The way into the gap interview (owner, toreview §146.7), on Profile and under a finished resume.
 * With nothing to ask, or before the questions have loaded, it draws nothing.
 */
export function GapInterviewCard({ onOpen, style }: GapInterviewCardProps) {
  const { spacing } = useTheme();
  const questions = useGapQuestions();
  const count = questions.data?.length ?? 0;
  if (count === 0) return null;

  return (
    <ProfileCard style={[{ gap: spacing[3], padding: spacing[5] }, style]}>
      <View style={{ gap: spacing[1] }}>
        <Text variant="title">{`${pluralize(count, 'quick question')} for you`}</Text>
        <Text variant="caption" color="textSecondary">
          Short answers make your next resume stronger.
        </Text>
      </View>
      <Button label="Answer them" variant="secondary" onPress={onOpen} block />
    </ProfileCard>
  );
}
