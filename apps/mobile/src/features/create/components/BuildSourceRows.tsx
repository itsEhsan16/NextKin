import { View } from 'react-native';

import type { Resume } from '@/data/models';
import { ResumeThumbnail } from '@/features/resumes/components/ResumeThumbnail';
import { pluralize } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';

const AVATAR = 34 / 0.75;
const PAGE_W = AVATAR * 0.8; // a resume page's 4:5
const PAGE_RADIUS = 5 / 0.75;

/** What a build starts from: the profile, a resume, or a file being read (§139, §172). */
export type BuildFromSource =
  | { kind: 'profile'; name: string; avatarUrl?: string; roles: number; skills: number }
  | { kind: 'resume'; resume: Resume }
  | { kind: 'reading'; fileName: string };

/** "Built from your profile · 4 roles, 12 skills" or "Built from <resume>". */
export function buildFromLabel(source: BuildFromSource): string {
  return source.kind === 'profile'
    ? `Built from your profile · ${pluralize(source.roles, 'role')}, ${pluralize(source.skills, 'skill')}`
    : source.kind === 'resume'
      ? `Built from ${source.resume.title}`
      : `Reading ${source.fileName}…`;
}

/** A resume's page at the avatar's size, for the source sheet. */
export function ResumePageTile() {
  const { colors, sizes } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.page, { borderWidth: sizes.border, borderColor: colors.borderDefault }]}>
      <ResumeThumbnail style={styles.fill} />
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  fill: { flex: 1 },
  page: { width: s(PAGE_W), height: s(AVATAR), borderRadius: s(PAGE_RADIUS), overflow: 'hidden' },
}));
