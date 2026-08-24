import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Resume } from '@/data/models';
import { a11yButton, formatRelativeTime, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { docPillLabel } from '../docMeta';
import { AtsBadge } from './AtsBadge';
import { DocTypePill, UpdateAvailablePill } from './DocPills';
import { ResumeThumbnail } from './ResumeThumbnail';

export type ResumeGridCardProps = {
  resume: Resume;
  onPress: (resume: Resume) => void;
  onOpenMenu: (resume: Resume) => void;
  onOpenScore: (resume: Resume) => void;
  style?: StyleProp<ViewStyle>;
};

const PAD = 11;
const MENU_ICON = 14;
/** Thumbnail is 204×200 inside the 228 card (Figma 1:1400). */
const THUMB_RATIO = 204 / 200;

function summarize(resume: Resume): string {
  const parts = [resume.title, docPillLabel(resume)];
  if (resume.updateAvailable) parts.push('update available');
  if (resume.atsScore != null) parts.push(`ATS score ${resume.atsScore}`);
  parts.push(`edited ${formatRelativeTime(resume.updatedAt)}`);
  return parts.join(', ');
}

/** One tile of the RESUMES 01 grid: thumbnail, floating ATS chip, title, age, type pill. */
export const ResumeGridCard = memo(function ResumeGridCard({
  resume,
  onPress,
  onOpenMenu,
  onOpenScore,
  style,
}: ResumeGridCardProps) {
  const { colors, spacing, s } = useTheme();
  const styles = useStyles();

  return (
    <Card radius="card" shadow="jobCard" padding={PAD} style={style}>
      <Pressable
        {...a11yButton(summarize(resume))}
        feedback="subtle"
        haptic="light"
        onPress={() => onPress(resume)}
        onLongPress={() => onOpenMenu(resume)}
        style={{ gap: spacing[2] }}
      >
        <View>
          <View
            style={{
              aspectRatio: THUMB_RATIO,
              borderRadius: s(10),
              borderWidth: s(1),
              borderColor: colors.borderDefault,
              overflow: 'hidden',
            }}
          >
            <ResumeThumbnail style={StyleSheet.absoluteFill} />
            {resume.updateAvailable ? (
              <UpdateAvailablePill style={{ position: 'absolute', top: s(9), left: s(9) }} />
            ) : null}
          </View>
          {resume.atsScore != null ? (
            <AtsBadge
              score={resume.atsScore}
              onPress={() => onOpenScore(resume)}
              style={styles.badge}
            />
          ) : null}
        </View>

        <View style={styles.titleRow}>
          <Text variant="titleSm" numberOfLines={1} style={styles.title}>
            {resume.title}
          </Text>
          <Pressable
            {...a11yButton(`More actions for ${resume.title}`)}
            feedback="subtle"
            haptic="light"
            hitSlop={hitSlopFor(MENU_ICON)}
            onPress={() => onOpenMenu(resume)}
          >
            <FontAwesome5 name="ellipsis-h" size={s(MENU_ICON)} color={colors.iconMuted} solid />
          </Pressable>
        </View>

        <Text variant="captionSm" color="textSecondary">
          {`Edited ${formatRelativeTime(resume.updatedAt)}`}
        </Text>

        <DocTypePill resume={resume} style={{ marginTop: spacing[1] }} />
      </Pressable>
    </Card>
  );
});

const useStyles = scaledSheet((s) => ({
  badge: { position: 'absolute', right: s(3), bottom: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: s(12) },
  title: { flex: 1 },
}));
