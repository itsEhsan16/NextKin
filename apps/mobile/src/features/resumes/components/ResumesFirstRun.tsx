import { View } from 'react-native';

import StartAiSparkleIcon from '../../../../assets/icons/resumes/start-ai-sparkle.svg';
import FirstRunIllustration from '../../../../assets/illustrations/resumes-first-run.svg';
import { a11yButton, a11yHeader } from '@/lib';
import { scaledSheet, useTheme, type ColorToken } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Icon, type LineIconName } from '@/ui/Icon';

export type ResumesFirstRunProps = {
  onUpload: () => void;
  onImportLinkedIn: () => void;
  onStartWithAi: () => void;
};

/** The illustration (Figma 395:1344 / 391:807), drawn 289.35 × 224.25 at 390. */
const ART = { w: 289.349 / 0.75, h: 224.25 / 0.75 } as const;
const CTA_HEIGHT = 64;
/** "Start with AI" leads with its own sparkle (529:25), 21.28 × 22 and 6.5 short of the label. */
const AI_SPARKLE = { w: 21.28 / 0.75, h: 22 / 0.75 } as const;
const AI_GAP = 6.47 / 0.75;
/**
 * The respaced 390 board (toreview.md 38.1), in artboard units: illustration → title 32,
 * title → lede 19, lede → first CTA 38, CTAs 19 apart, last CTA → footnote 37.
 */
const TITLE_TOP = 32;
const LEDE_TOP = 19;
const CTAS_TOP = 38;
const CTA_GAP = 19;
const FOOTNOTE_TOP = 37;

type CtaTone = 'primary' | 'outline' | 'brand';

function Cta({
  tone,
  icon,
  label,
  onPress,
}: {
  tone: CtaTone;
  icon?: LineIconName;
  label: string;
  onPress: () => void;
}) {
  const { colors, radii, spacing, s } = useTheme();
  const styles = useStyles();

  const surface = {
    primary: { bg: colors.surfaceInverse, border: 'transparent', fg: 'textOnDark' as ColorToken },
    outline: {
      bg: colors.surfaceCard,
      border: colors.borderDefault,
      fg: 'textPrimary' as ColorToken,
    },
    brand: { bg: colors.brandSurface, border: colors.brandBorder, fg: 'brand' as ColorToken },
  }[tone];

  return (
    <Pressable
      {...a11yButton(label)}
      feedback="scale"
      haptic="light"
      onPress={onPress}
      style={[
        styles.cta,
        {
          height: s(CTA_HEIGHT),
          gap: tone === 'brand' ? s(AI_GAP) : spacing[2] + 2,
          borderRadius: radii.xxl,
          backgroundColor: surface.bg,
          borderWidth: surface.border === 'transparent' ? 0 : 1,
          borderColor: surface.border,
        },
      ]}
    >
      {tone === 'brand' ? (
        <StartAiSparkleIcon width={s(AI_SPARKLE.w)} height={s(AI_SPARKLE.h)} />
      ) : icon ? (
        <Icon name={icon} size="sm" color={colors[surface.fg]} />
      ) : null}
      <Text variant="label" color={surface.fg}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * RESUMES 05 (Figma 95:2262) — the whole tab before the first document exists. The parent
 * centres this block in the space under the title row, as the board does.
 */
export function ResumesFirstRun({
  onUpload,
  onImportLinkedIn,
  onStartWithAi,
}: ResumesFirstRunProps) {
  const { s } = useTheme();
  const styles = useStyles();

  return (
    <View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.illustration}
      >
        <FirstRunIllustration width={s(ART.w)} height={s(ART.h)} />
      </View>

      <Text
        {...a11yHeader()}
        variant="headlineLg"
        align="center"
        style={{ marginTop: s(TITLE_TOP) }}
      >
        {"Let's build your first resume"}
      </Text>
      <Text
        variant="body"
        color="textSecondary"
        align="center"
        style={[styles.lede, { marginTop: s(LEDE_TOP) }]}
      >
        Start from what you already have — most people are done in under ten minutes.
      </Text>

      <View style={{ gap: s(CTA_GAP), marginTop: s(CTAS_TOP) }}>
        <Cta tone="primary" icon="UploadCloud02" label="Upload PDF or DOCX" onPress={onUpload} />
        <Cta tone="outline" icon="Link01" label="Import from LinkedIn" onPress={onImportLinkedIn} />
        <Cta tone="brand" label="Start with AI" onPress={onStartWithAi} />
      </View>

      <Text
        variant="caption"
        color="textSecondary"
        align="center"
        style={{ marginTop: s(FOOTNOTE_TOP) }}
      >
        Free plan includes 2 resumes and watermark-free PDF export — always.
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  illustration: { alignItems: 'center' },
  lede: { alignSelf: 'center', maxWidth: s(320) },
}));
