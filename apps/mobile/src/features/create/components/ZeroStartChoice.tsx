import { View } from 'react-native';

import ScratchIcon from '../../../../assets/icons/create/scratch.svg';
import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { OptionSheetHeader } from '@/ui/OptionSheet';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { UploadPromptRow } from './TailorResumeRows';
import { Icon } from '@/ui/Icon';

// ZERO 00b's sheet at 390 (613:148), in artboard units.
const HEADER_TO_ROWS = 14 / 0.75; // 613:156 + 613:157
const ROW_GAP_Y = 10 / 0.75; // 613:182
const ROWS_TO_NOTE = 16 / 0.75; // 613:203
const ROW_RADIUS = 15 / 0.75; // 613:183
const ROW_PAD_L = 12 / 0.75;
const ROW_PAD_R = 14 / 0.75;
const ROW_PAD_Y = 12 / 0.75;
const ROW_GAP = 12 / 0.75;
const LINE_GAP = 2 / 0.75;
const ICON_W = 36 / 0.75; // 613:184
const ICON_H = 37.573 / 0.75;

/** "Start from nothing" (613:183): the lavender row that opens Zero Resume for this job. */
function StartFromNothingRow({ onPress }: { onPress: () => void }) {
  const { colors, sizes, s } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      {...a11yButton(
        'Start from nothing',
        'We write a first draft for this job from your name and years of work',
      )}
      feedback="scale"
      onPress={onPress}
      style={[
        styles.row,
        {
          borderWidth: sizes.border,
          borderColor: colors.brandBorder,
          backgroundColor: colors.brandSurface,
        },
      ]}
    >
      <ScratchIcon width={s(ICON_W)} height={s(ICON_H)} />
      <View style={styles.text}>
        <Text variant="menuRow" numberOfLines={1}>
          Start from nothing
        </Text>
        <Text variant="micro" color="textSecondary">
          We write a first draft for this job from your name and years of work
        </Text>
      </View>
      <Icon name="ChevronRight" size="sm" color={colors.iconChevron} />
    </Pressable>
  );
}

/**
 * ZERO 00b (613:148) — the Tailor sheet when there is nothing to tailor: upload a resume, or start
 * from nothing. Both come back to the job: an upload continues in this sheet, and a Zero Resume
 * run returns to the job when its ✕ is pressed.
 */
export function ZeroStartChoice({
  company,
  onUpload,
  onStartFromNothing,
  onClose,
}: {
  company: string;
  onUpload: () => void;
  onStartFromNothing: () => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  return (
    <View>
      <OptionSheetHeader
        variant="card"
        title="You don’t have a resume yet"
        subtitle={`Pick how to start. Both come back to this ${company} job.`}
        onClose={onClose}
      />
      <View style={styles.rows}>
        <UploadPromptRow onPress={onUpload} />
        <StartFromNothingRow onPress={onStartFromNothing} />
      </View>
      <Text variant="caption" color="textSecondary" align="center" style={styles.note}>
        Every guess in the draft is marked for you to check.
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  rows: { marginTop: s(HEADER_TO_ROWS), gap: s(ROW_GAP_Y) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(ROW_GAP),
    borderRadius: s(ROW_RADIUS),
    paddingLeft: s(ROW_PAD_L),
    paddingRight: s(ROW_PAD_R),
    paddingVertical: s(ROW_PAD_Y),
  },
  text: { flex: 1, gap: s(LINE_GAP) },
  note: { marginTop: s(ROWS_TO_NOTE) },
}));
