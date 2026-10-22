import FontAwesome5 from '@expo/vector-icons/FontAwesome5';

import AiSparkle from '../../../../assets/icons/jobs/ai-sparkle.svg';
import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type TailorResumeCtaProps = { onPress: () => void };

/**
 * Drawn values over 0.75: a 53-tall row, the sparkle 18 in and 13 from the copy, and a chevron
 * drawn at 20.9 ending ~8.5 from the right edge.
 */
const CTA = {
  height: 70.6667,
  paddingLeft: 24,
  paddingRight: 11.3333,
  gap: 17.3333,
  sparkle: 32,
  sparkleHeight: 33.1051,
  chevron: 27.8573,
};

/**
 * The brand-tinted "Tailor your resume to this job" row (Figma 443:41) — the screen's AI entry
 * point, redrawn as a single line led by the same sparkle the job cards' tailor button uses.
 *
 * The board drops a soft blue shadow under the sparkle; SVGR strips filters from `.svg` imports,
 * so the shared asset renders without it. See toreview.md.
 */
export function TailorResumeCta({ onPress }: TailorResumeCtaProps) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();

  return (
    <Pressable
      {...a11yButton(
        'Tailor your resume to this job',
        'Creates a linked variant; match updates live',
      )}
      feedback="scale"
      haptic="light"
      onPress={onPress}
      style={[
        styles.row,
        {
          borderRadius: radii.card,
          backgroundColor: colors.brandSurface,
          borderWidth: s(1),
          borderColor: colors.brandBorder,
        },
      ]}
    >
      <AiSparkle width={s(CTA.sparkle)} height={s(CTA.sparkleHeight)} />
      <Text variant="label" color="brand" numberOfLines={1} style={styles.copy}>
        Tailor your resume to this job
      </Text>
      <FontAwesome5 name="chevron-right" size={s(CTA.chevron)} color={colors.iconMuted} solid />
    </Pressable>
  );
}

const useStyles = scaledSheet((s) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: s(CTA.height),
    paddingLeft: s(CTA.paddingLeft),
    paddingRight: s(CTA.paddingRight),
    gap: s(CTA.gap),
  },
  copy: { flex: 1 },
}));
