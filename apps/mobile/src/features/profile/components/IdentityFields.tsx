import { useRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { a11yButton, hitSlop8, useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Chip } from '@/ui/Chip';
import { Pressable } from '@/ui/Pressable';
import { TextField } from '@/ui/TextField';

import { citySuggestions, HEADLINE_MAX, type IdentityDraft } from '../identityForm';

export type IdentityFieldsProps = {
  draft: IdentityDraft;
  /** Only the messages that have earned their place — see the screen's `touched`/`refused`. */
  errors: Record<string, string>;
  onChange: (key: keyof IdentityDraft, value: string) => void;
  onBlurField: (key: keyof IdentityDraft) => void;
};

/**
 * The five text fields of "Edit profile" (V2 §7.3), in the order the page reads: the two halves
 * of a name, the line under it, where the reader is, and how long they have been doing this.
 *
 * The draft lives on the screen rather than here, because the pinned bar and the discard sheet
 * are this block's siblings and both read it.
 */
export function IdentityFields({ draft, errors, onChange, onBlurField }: IdentityFieldsProps) {
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();

  // Chained with returnKeyType="next": the keyboard's Next key hands focus down the form rather
  // than dismissing itself between every field.
  const lastNameRef = useRef<TextInput>(null);
  const headlineRef = useRef<TextInput>(null);

  const cities = citySuggestions(draft.location);

  return (
    <>
      <TextField
        label="First name"
        value={draft.firstName}
        onChangeText={(value) => onChange('firstName', value)}
        onBlur={() => onBlurField('firstName')}
        error={errors.firstName}
        autoCapitalize="words"
        autoComplete="given-name"
        returnKeyType="next"
        onSubmit={() => lastNameRef.current?.focus()}
      />

      <TextField
        ref={lastNameRef}
        label="Last name"
        value={draft.lastName}
        onChangeText={(value) => onChange('lastName', value)}
        onBlur={() => onBlurField('lastName')}
        error={errors.lastName}
        autoCapitalize="words"
        autoComplete="family-name"
        returnKeyType="next"
        onSubmit={() => headlineRef.current?.focus()}
      />

      <TextField
        ref={headlineRef}
        label="Headline"
        placeholder="Senior UX Designer"
        value={draft.headline}
        onChangeText={(value) => onChange('headline', value)}
        onBlur={() => onBlurField('headline')}
        error={errors.headline}
        maxLength={HEADLINE_MAX}
        showCount
      />

      <View style={{ gap: spacing[3] }}>
        <TextField
          label="Location"
          icon="map-marker-alt"
          placeholder="City or region"
          value={draft.location}
          onChangeText={(value) => onChange('location', value)}
          onBlur={() => onBlurField('location')}
          autoCapitalize="words"
        />
        {/* Offered only once there is something to match, so an untouched field is not a wall of
            chips that reads as a required choice. */}
        {cities.length > 0 ? (
          <Animated.View
            entering={reduced ? undefined : FadeIn.duration(motion.durations.base)}
            style={[styles.chips, { gap: spacing[2] }]}
          >
            {cities.map((city) => (
              <Pressable
                key={city}
                {...a11yButton(`Use ${city}`)}
                feedback="scale"
                haptic="selection"
                hitSlop={hitSlop8}
                onPress={() => onChange('location', city)}
              >
                <Chip label={city} />
              </Pressable>
            ))}
          </Animated.View>
        ) : null}
      </View>

      <TextField
        label="Years of experience"
        // Carries what the cut helper carried: the validator only speaks after a bad value is
        // typed, so nothing else says this one may be left blank.
        placeholder="Optional"
        value={draft.yearsExperience}
        onChangeText={(value) => onChange('yearsExperience', value)}
        onBlur={() => onBlurField('yearsExperience')}
        error={errors.yearsExperience}
        keyboardType="number-pad"
        maxLength={3}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
