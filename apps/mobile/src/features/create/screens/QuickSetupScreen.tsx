import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ZERO_YEARS, ZERO_YEARS_LABEL, type ZeroYears } from '@/data/models';
import { scaledSheet } from '@/theme';
import { Button } from '@/ui/Button';
import { ChoiceChip } from '@/ui/ChoiceChip';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { OnboardingFrame } from '../components/OnboardingFrame';
import { SUGGESTED_ROLES, useSetupAnswers } from '../setupAnswers';

const YEARS_LABEL = (band: ZeroYears): string =>
  band === 'none' ? 'Just starting' : `${ZERO_YEARS_LABEL[band]} yrs`;

/**
 * Step 1 of 2 after sign-up (toreview.md §172): the role you want and your experience, as
 * one-tap chips. Skippable. The answers prefill the flows that would otherwise ask again.
 */
export function QuickSetupScreen() {
  const router = useRouter();
  const styles = useStyles();
  const saved = useSetupAnswers();
  const [role, setRole] = useState(saved.role);
  const [years, setYears] = useState<ZeroYears | null>(saved.years);

  const next = () => router.replace('/create/start');

  return (
    <OnboardingFrame
      step={1}
      total={2}
      title="What’s your next role?"
      subtitle="We’ll tune jobs and resumes to it."
      onSkip={() => {
        saved.skip();
        next();
      }}
      footer={
        <Button
          label="Continue"
          size="xl"
          block
          disabled={!role.trim()}
          onPress={() => {
            saved.save({ role: role.trim(), years });
            next();
          }}
        />
      }
    >
      <TextField
        label="Role"
        icon="Briefcase01"
        placeholder="e.g. Product Designer"
        value={role}
        onChangeText={setRole}
        autoCapitalize="words"
        returnKeyType="done"
      />
      <View style={styles.chips}>
        {SUGGESTED_ROLES.map((suggestion) => (
          <ChoiceChip
            key={suggestion}
            label={suggestion}
            selected={role === suggestion}
            onPress={() => setRole(role === suggestion ? '' : suggestion)}
          />
        ))}
      </View>

      <Text variant="title3" color="ink" style={styles.section}>
        Experience
      </Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {ZERO_YEARS.map((band) => (
          <ChoiceChip
            radio
            key={band}
            label={YEARS_LABEL(band)}
            selected={years === band}
            onPress={() => setYears(years === band ? null : band)}
          />
        ))}
      </View>
    </OnboardingFrame>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8), marginTop: u(14) },
  section: { marginTop: u(32) },
}));
