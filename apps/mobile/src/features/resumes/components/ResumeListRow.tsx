import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Resume } from '@/data/models';
import { a11yButton, formatRelativeTime, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { docSubtitle } from '../docMeta';
import { AtsBadge } from './AtsBadge';
import { DocTypePill, UpdateAvailablePill } from './DocPills';
import { ResumeThumbnail } from './ResumeThumbnail';

export type ResumeListRowProps = {
  resume: Resume;
  onPress: (resume: Resume) => void;
  onOpenMenu: (resume: Resume) => void;
  onOpenScore: (resume: Resume) => void;
  style?: StyleProp<ViewStyle>;
};

const PAD = 15;
const THUMB = { width: 64, height: 94 } as const;
const MENU_ICON = 14;

function summarize(resume: Resume): string {
  const parts = [resume.title, docSubtitle(resume)];
  if (resume.updateAvailable) parts.push('update available');
  if (resume.atsScore != null) parts.push(`ATS score ${resume.atsScore}`);
  parts.push(`edited ${formatRelativeTime(resume.updatedAt)}`);
  return parts.join(', ');
}

/**
 * One row of the RESUMES 02 list. The footer pill mirrors the artboard exactly: Base and cover
 * letters keep their type pill, stale docs swap it for "Update available", and a plain tailored
 * doc shows only its age.
 */
export const ResumeListRow = memo(function ResumeListRow({
  resume,
  onPress,
  onOpenMenu,
  onOpenScore,
  style,
}: ResumeListRowProps) {
  const { colors, spacing } = useTheme();
  const styles = useStyles();

  const footerPill = resume.updateAvailable ? (
    <UpdateAvailablePill />
  ) : resume.isBase || resume.docType === 'cover_letter' ? (
    <DocTypePill resume={resume} />
  ) : null;

  return (
    <Card radius="card" shadow="jobCard" padding={PAD} style={style}>
      <Pressable
        {...a11yButton(summarize(resume))}
        feedback="subtle"
        haptic="light"
        onPress={() => onPress(resume)}
        onLongPress={() => onOpenMenu(resume)}
        style={[styles.row, { gap: spacing[4] }]}
      >
        <View
          style={{
            width: THUMB.width,
            height: THUMB.height,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.borderDefault,
            overflow: 'hidden',
          }}
        >
          <ResumeThumbnail style={StyleSheet.absoluteFill} />
        </View>

        <View style={styles.body}>
          <Text variant="label" numberOfLines={1}>
            {resume.title}
          </Text>
          <Text variant="rowDescription" color="textSecondary" numberOfLines={1}>
            {docSubtitle(resume)}
          </Text>
          <View style={[styles.footer, { gap: spacing[2] + 2, marginTop: spacing[2] }]}>
            {footerPill}
            <Text variant="captionSm" color="textTertiary">
              {`Edited ${formatRelativeTime(resume.updatedAt)}`}
            </Text>
          </View>
        </View>

        <View style={styles.trailing}>
          <Pressable
            {...a11yButton(`More actions for ${resume.title}`)}
            feedback="subtle"
            haptic="light"
            hitSlop={hitSlopFor(MENU_ICON)}
            onPress={() => onOpenMenu(resume)}
            style={styles.menu}
          >
            <FontAwesome5 name="ellipsis-h" size={MENU_ICON} color={colors.iconMuted} solid />
          </Pressable>
          {resume.atsScore != null ? (
            <AtsBadge score={resume.atsScore} onPress={() => onOpenScore(resume)} />
          ) : null}
        </View>
      </Pressable>
    </Card>
  );
});

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row' },
  body: { flex: 1, gap: s(2) },
  footer: { flexDirection: 'row', alignItems: 'center' },
  trailing: { alignItems: 'flex-end', justifyContent: 'space-between' },
  menu: { paddingTop: s(2) },
}));
