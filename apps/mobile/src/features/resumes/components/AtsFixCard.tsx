import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useEffect, useRef } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ProfileCard } from '@/features/profile/components/cards';
import { a11yButton, haptics, hitSlopFor, useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { layoutTransition, Spinner, SuccessMark, useBecameTrue } from '@/ui/motion';

import { fixSectionLabel, type FixRow } from '../atsFixRows';

export type AtsFixCardProps = {
  row: FixRow;
  onApply: (item: FixRow['item']) => void;
  /** Reports the card's y inside the scroll content, so the deep-linked item can be revealed. */
  onLayout?: (id: string, y: number) => void;
};

// The fix card at 390 (RESUMES 09 577:9501), in artboard units.
const GAP = 12 / 0.75;
const STATUS_W = 18 / 0.75;
const STATUS_H = 20 / 0.75;
const STATUS_GLYPH = 16 / 0.75;
const TEXT_GAP = 4 / 0.75;
const FOOTER_TOP = 6 / 0.75;
const PILL_PAD_X = 10 / 0.75;
const PILL_PAD_Y = 4 / 0.75;
const APPLY_H = 30 / 0.75;
const APPLY_PAD_X = 12 / 0.75;
const NOTE_GLYPH = 13 / 0.75;

/** V2 §7.8: a keyword the profile does not back is shown, never written in. */
const GAP_NOTE = "Not on your profile — only add it if it's true";

/**
 * One check on the AI fix list (RESUMES 09): a status ring, what the score found, what applying
 * would do, and a footer with the section the edit lands in and a small Apply. Applied, the ring
 * fills green and the button gives way to "Applied"; a gap — a keyword the profile does not back —
 * has no Apply at all, and says why.
 */
export function AtsFixCard({ row, onApply, onLayout }: AtsFixCardProps) {
  const { colors, motion, radii, spacing, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();

  const { item, state } = row;
  const done = state === 'done';
  const gap = state === 'gap';
  const applying = state === 'applying';
  // A fix applied while the user watched draws its tick in; one already applied rests drawn.
  const justDone = useBecameTrue(done);

  // Once per item, tied to the tick appearing rather than to the request returning: the ref is
  // per card, and a card is keyed by its check id, so a re-render can never sound it twice.
  const celebrated = useRef(false);
  useEffect(() => {
    if (!done || celebrated.current) return;
    celebrated.current = true;
    haptics.success();
  }, [done]);

  // Reduced motion drops both, rather than shortening them: a card resizing under the reader is
  // the movement the setting is asking us not to make.
  const layout = layoutTransition(reduced);
  const tick = reduced ? undefined : FadeIn.duration(motion.durations.base);

  const section = fixSectionLabel(item.section);

  const handleLayout = onLayout
    ? (event: LayoutChangeEvent) => onLayout(item.id, event.nativeEvent.layout.y)
    : undefined;

  return (
    <Animated.View layout={layout} onLayout={handleLayout}>
      {/* A gap is not an action, so it does not wear an actionable card: the subtle fill the rest
          of the app uses for inert surfaces. */}
      <ProfileCard
        style={[
          styles.card,
          { padding: spacing[5] },
          gap ? { backgroundColor: colors.surfaceSubtle } : null,
        ]}
      >
        <View style={styles.status}>
          {done ? (
            <SuccessMark size={s(STATUS_GLYPH)} animate={justDone} />
          ) : gap ? (
            <FontAwesome5 name="info-circle" size={s(NOTE_GLYPH)} color={colors.iconMuted} solid />
          ) : (
            <FontAwesome5 name="circle" size={s(STATUS_GLYPH)} color={colors.borderDashed} />
          )}
        </View>

        <View style={styles.text}>
          <View
            accessible
            accessibilityLabel={[item.label, item.suggestion, gap ? GAP_NOTE : undefined]
              .filter(Boolean)
              .join('. ')}
            style={styles.copy}
          >
            <Text variant="label" color={gap ? 'textSecondary' : 'textPrimary'}>
              {item.label}
            </Text>
            {item.suggestion ? (
              <Text variant="body" color="textSecondary">
                {item.suggestion}
              </Text>
            ) : null}
            {gap ? (
              <Text variant="caption" color="textTertiary">
                {GAP_NOTE}
              </Text>
            ) : null}
          </View>

          <View style={styles.footer}>
            {section ? (
              <View
                style={[
                  styles.pill,
                  {
                    borderRadius: radii.full,
                    backgroundColor: gap ? colors.surfaceCard : colors.surfaceSubtle,
                  },
                ]}
              >
                <Text variant="micro" color="textBody" numberOfLines={1}>
                  {section}
                </Text>
              </View>
            ) : (
              <View />
            )}

            {done ? (
              <Animated.View entering={tick}>
                <Text variant="captionSemiBold" color="success">
                  Applied
                </Text>
              </Animated.View>
            ) : null}

            {state === 'todo' || applying ? (
              <Pressable
                {...a11yButton('Apply', item.label)}
                accessibilityState={{ disabled: applying, busy: applying }}
                feedback="scale"
                haptic="light"
                hitSlop={hitSlopFor(s(APPLY_H))}
                disabled={applying}
                onPress={() => onApply(item)}
                style={[
                  styles.apply,
                  { borderRadius: radii.full, backgroundColor: colors.surfaceSubtle },
                ]}
              >
                {applying ? (
                  <Spinner size={s(15 / 0.75)} color="textPrimary" />
                ) : (
                  <Text variant="captionSemiBold">Apply</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      </ProfileCard>
    </Animated.View>
  );
}

const useStyles = scaledSheet((s) => ({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: s(GAP) },
  status: {
    width: s(STATUS_W),
    height: s(STATUS_H),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: s(TEXT_GAP) },
  copy: { gap: s(TEXT_GAP) },
  footer: {
    marginTop: s(FOOTER_TOP),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: s(GAP),
  },
  pill: { flexShrink: 1, paddingHorizontal: s(PILL_PAD_X), paddingVertical: s(PILL_PAD_Y) },
  apply: {
    height: s(APPLY_H),
    paddingHorizontal: s(APPLY_PAD_X),
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
