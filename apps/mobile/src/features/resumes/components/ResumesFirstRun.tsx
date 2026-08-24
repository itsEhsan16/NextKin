import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';

import SparkleIcon from '../../../../assets/icons/ai-sparkle.svg';
import { a11yButton, a11yHeader } from '@/lib';
import { scaledSheet, useTheme, type ColorToken } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { ResumeThumbnail } from './ResumeThumbnail';

export type ResumesFirstRunProps = {
  onUpload: () => void;
  onImportLinkedIn: () => void;
  onStartWithAi: () => void;
};

/** Illustration geometry from the 520pt artboard (Figma 1:2065–1:2067). */
const GHOST = { width: 140, height: 186 } as const;
const PAGE = { width: 160, height: 206 } as const;
const CTA_HEIGHT = 64;
const CTA_ICON = 16;

type CtaTone = 'primary' | 'outline' | 'brand';

function Cta({
  tone,
  icon,
  label,
  onPress,
}: {
  tone: CtaTone;
  icon?: string;
  label: string;
  onPress: () => void;
}) {
  const { colors, radii, spacing, s } = useTheme();
  const styles = useStyles();

  const surface = {
    primary: { bg: colors.surfaceInverse, border: 'transparent', fg: 'textOnDark' as ColorToken },
    outline: { bg: colors.surfaceCard, border: colors.borderDefault, fg: 'textPrimary' as ColorToken },
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
          gap: spacing[2] + 2,
          borderRadius: radii.xxl,
          backgroundColor: surface.bg,
          borderWidth: surface.border === 'transparent' ? 0 : 1,
          borderColor: surface.border,
        },
      ]}
    >
      {tone === 'brand' ? (
        <SparkleIcon width={s(15)} height={s(15)} color={colors.brand} />
      ) : icon ? (
        <FontAwesome5 name={icon} size={s(CTA_ICON)} color={colors[surface.fg]} solid />
      ) : null}
      <Text variant="label" color={surface.fg}>
        {label}
      </Text>
    </Pressable>
  );
}

/** RESUMES 05 (Figma 1:2061) — the whole tab before the first document exists. */
export function ResumesFirstRun({ onUpload, onImportLinkedIn, onStartWithAi }: ResumesFirstRunProps) {
  const { colors, shadows, spacing, s } = useTheme();
  const styles = useStyles();

  const ghost = { width: s(GHOST.width), height: s(GHOST.height) };
  const page = { width: s(PAGE.width), height: s(PAGE.height) };

  return (
    <View style={{ gap: spacing[3] }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.illustration, { height: page.height + spacing[6], marginTop: spacing[10] }]}
      >
        <View
          style={[
            styles.ghost,
            ghost,
            { borderRadius: s(14), backgroundColor: colors.surfaceGhost, left: '50%' },
            { transform: [{ translateX: -ghost.width - 6 }, { translateY: 8 }] },
          ]}
        />
        <View
          style={[
            styles.ghost,
            ghost,
            { borderRadius: s(14), backgroundColor: colors.surfaceSubtle, left: '50%' },
            { transform: [{ translateX: 6 }, { translateY: 8 }] },
          ]}
        />
        <View
          style={[
            page,
            styles.page,
            shadows.docFloat,
            {
              borderRadius: s(10),
              borderWidth: s(1),
              borderColor: colors.borderDefault,
              backgroundColor: colors.surfaceCard,
            },
          ]}
        >
          <ResumeThumbnail style={StyleSheet.absoluteFill} />
        </View>
      </View>

      <Text {...a11yHeader()} variant="headlineLg" align="center" style={{ marginTop: spacing[6] }}>
        {"Let's build your first resume"}
      </Text>
      <Text variant="body" color="textSecondary" align="center" style={styles.lede}>
        Start from what you already have — most people are done in under ten minutes.
      </Text>

      <View style={{ gap: spacing[3], marginTop: spacing[5] }}>
        <Cta tone="primary" icon="upload" label="Upload PDF or DOCX" onPress={onUpload} />
        <Cta tone="outline" icon="link" label="Import from LinkedIn" onPress={onImportLinkedIn} />
        <Cta tone="brand" label="Start with AI" onPress={onStartWithAi} />
      </View>

      <Text variant="caption" color="textSecondary" align="center" style={{ marginTop: spacing[3] }}>
        Free plan includes 2 resumes and watermark-free PDF export — always.
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  illustration: { alignItems: 'center', justifyContent: 'flex-start' },
  ghost: { position: 'absolute', top: s(14) },
  page: { overflow: 'hidden' },
  lede: { alignSelf: 'center', maxWidth: s(320) },
}));
