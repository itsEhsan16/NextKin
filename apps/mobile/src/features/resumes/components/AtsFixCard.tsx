import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useEffect, useRef } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { haptics, useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Text } from '@/ui/Text';

import { fixSectionLabel, type FixRow } from '../atsFixRows';

export type AtsFixCardProps = {
  row: FixRow;
  onApply: (item: FixRow['item']) => void;
  /** Reports the card's y inside the scroll content, so the deep-linked item can be revealed. */
  onLayout?: (id: string, y: number) => void;
};

const CHECK = 15;
const GAP_ICON = 13;

/** V2 §7.8: a keyword the profile does not back is shown, never written in. */
const GAP_NOTE = "Not on your profile — only add it if it's true";

/**
 * One check on the AI fix list: what the score found, what applying would do, the section the
 * edit lands in, and the action — or, for a gap, the reason there is no action.
 */
export function AtsFixCard({ row, onApply, onLayout }: AtsFixCardProps) {
  const { colors, motion, spacing, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();

  const { item, state } = row;
  const done = state === 'done';
  const gap = state === 'gap';

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
  const layout = reduced ? undefined : LinearTransition.springify();
  const tick = reduced ? undefined : FadeIn.duration(motion.durations.base);

  const section = fixSectionLabel(item.section);

  const handleLayout = onLayout
    ? (event: LayoutChangeEvent) => onLayout(item.id, event.nativeEvent.layout.y)
    : undefined;

  return (
    <Animated.View layout={layout} onLayout={handleLayout}>
      {/* A gap is not an action, so it does not wear an actionable card: no lift, and the
          subtle fill the rest of the app uses for inert surfaces. */}
      <Card
        radius="card"
        elevated={!gap}
        style={[{ gap: spacing[3] }, gap ? { backgroundColor: colors.surfaceSubtle } : null]}
      >
        <View
          accessible
          accessibilityLabel={[item.label, item.suggestion, gap ? GAP_NOTE : undefined]
            .filter(Boolean)
            .join('. ')}
          style={{ gap: spacing[1] }}
        >
          <Text variant="title" color={gap ? 'textSecondary' : 'textPrimary'}>
            {item.label}
          </Text>
          {item.suggestion ? (
            <Text variant="body" color="textSecondary">
              {item.suggestion}
            </Text>
          ) : null}
        </View>

        {gap ? (
          <View style={[styles.noteRow, { gap: spacing[2] }]}>
            <FontAwesome5 name="info-circle" size={s(GAP_ICON)} color={colors.iconMuted} solid />
            <Text variant="caption" color="textTertiary" style={styles.fill}>
              {GAP_NOTE}
            </Text>
          </View>
        ) : null}

        <View style={[styles.actionRow, { gap: spacing[3] }]}>
          {section ? <Chip label={section} style={styles.chip} /> : <View style={styles.fill} />}

          {done ? (
            <Animated.View entering={tick} style={[styles.doneRow, { gap: spacing[2] }]}>
              <FontAwesome5 name="check-circle" size={s(CHECK)} color={colors.success} solid />
              <Text variant="captionSemiBold" color="success">
                Applied
              </Text>
            </Animated.View>
          ) : null}

          {state === 'todo' || state === 'applying' ? (
            <Button
              label="Apply"
              variant="secondary"
              loading={state === 'applying'}
              onPress={() => onApply(item)}
            />
          ) : null}
        </View>
      </Card>
    </Animated.View>
  );
}

const useStyles = scaledSheet(() => ({
  fill: { flex: 1 },
  noteRow: { flexDirection: 'row', alignItems: 'center' },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { flexShrink: 1 },
  doneRow: { flexDirection: 'row', alignItems: 'center' },
}));
