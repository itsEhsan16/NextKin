import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import AiSparkle from '../../../../assets/icons/jobs/ai-sparkle.svg';
import { a11yButton, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme, type ColorToken } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { BookmarkGlyph } from './BookmarkGlyph';

export type JobCardFooterProps = {
  /** "Posted 2d ago", "Saved 4d ago", "Closing in 3d", "Applied 12d ago". */
  note: string;
  /** `warningStrong` carries the urgency the Saved board gives a closing posting (521:32). */
  noteColor?: ColorToken;
  /** Discover and Saved: tailor + bookmark. Applied: a chevron into the application instead. */
  variant: 'actions' | 'chevron';
  saved?: boolean;
  saveLabel?: string;
  tailorLabel?: string;
  onTailor?: () => void;
  onToggleSave?: () => void;
};

/** Drawn values over 0.75 — a 30 box per action, 25 apart, under a 0.75 rule. */
const FOOTER = { box: 40, gap: 33.3333, sparkle: 32.7191, sparkleHeight: 32, bookmark: 29.6973 };
const CHEVRON = 16;

/**
 * The row under the divider on every redrawn job card (Figma 498:31 / 521:31 / 521:265).
 *
 * The two buttons are 30 drawn, which is 30dp on a 390 phone and under the 44pt floor, so each
 * takes a hit slop out to it rather than being drawn larger than the board.
 */
export function JobCardFooter({
  note,
  noteColor = 'textSecondary',
  variant,
  saved = false,
  saveLabel,
  tailorLabel,
  onTailor,
  onToggleSave,
}: JobCardFooterProps) {
  const { colors, s } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.row}>
      <Text variant="caption" color={noteColor} numberOfLines={1}>
        {note}
      </Text>

      {variant === 'chevron' ? (
        <FontAwesome5 name="chevron-right" size={s(CHEVRON)} color={colors.iconMuted} solid />
      ) : (
        <View style={styles.actions}>
          <Pressable
            {...a11yButton(tailorLabel ?? 'Tailor with AI')}
            feedback="scale"
            haptic="light"
            hitSlop={hitSlopFor(s(FOOTER.box))}
            onPress={onTailor}
            style={styles.action}
          >
            <AiSparkle width={s(FOOTER.sparkle)} height={s(FOOTER.sparkleHeight)} />
          </Pressable>

          <Pressable
            {...a11yButton(saveLabel ?? 'Save')}
            accessibilityState={{ selected: saved }}
            feedback="scale"
            haptic="light"
            hitSlop={hitSlopFor(s(FOOTER.box))}
            onPress={onToggleSave}
            style={styles.action}
          >
            <BookmarkGlyph
              saved={saved}
              size={s(FOOTER.bookmark)}
              color={saved ? colors.brand : colors.textPrimary}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: s(FOOTER.gap) },
  action: {
    width: s(FOOTER.box),
    height: s(FOOTER.box),
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
