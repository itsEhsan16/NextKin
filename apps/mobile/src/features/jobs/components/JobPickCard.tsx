import { memo, useCallback, useMemo } from 'react';
import { View, type AccessibilityActionEvent } from 'react-native';

import { EMPLOYMENT_TYPE_LABEL, REMOTE_TYPE_LABEL, type Job } from '@/data/models';
import { a11yButton, formatSalary, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { LogoTile } from '@/ui/LogoTile';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { BookmarkGlyph } from './BookmarkGlyph';
import { jobCardLabel } from './jobCardMeta';
import { MatchBadge, TagPill } from './JobPills';

export type JobPickCardProps = {
  job: Job;
  width: number;
  onPress: (job: Job) => void;
  onToggleSave: (job: Job) => void;
};

/** Drawn values over 0.75 — a 280 × 150.5 card at 14 padding, with a 30 logo. */
const PICK = {
  padding: 18.6667,
  gap: 13.3333,
  logo: 40,
  logoRadius: 12,
  logoGap: 12,
  badgeGap: 10.6667,
  bookmark: 20,
  rowGap: 8,
};
/** Custom VoiceOver/TalkBack action that reaches the bookmark the card would otherwise swallow. */
const SAVE_ACTION = 'save';

/**
 * Figma 519:2 — the "Today's picks" card, redrawn.
 *
 * A narrower sibling of the list card: company and match badge on the header row, the title, the
 * salary, and a short tag row. It carries no match reason, and its two tags take a leading glyph
 * where the list card's go bare.
 */
export const JobPickCard = memo(function JobPickCard({
  job,
  width,
  onPress,
  onToggleSave,
}: JobPickCardProps) {
  const { colors, s } = useTheme();
  const styles = useStyles();

  const saveLabel = job.isSaved ? `Remove ${job.title} from saved` : `Save ${job.title}`;
  const workplace = REMOTE_TYPE_LABEL[job.remote];
  const place = job.location.toLowerCase().includes(workplace.toLowerCase())
    ? job.location
    : workplace;

  const actions = useMemo(() => [{ name: SAVE_ACTION, label: saveLabel }], [saveLabel]);

  const handleAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === SAVE_ACTION) onToggleSave(job);
    },
    [job, onToggleSave],
  );

  return (
    <Pressable
      {...a11yButton(jobCardLabel(job, ''))}
      accessibilityActions={actions}
      onAccessibilityAction={handleAction}
      feedback="scale"
      haptic="light"
      onPress={() => onPress(job)}
      style={{ width }}
    >
      <Card padding={s(PICK.padding)} elevated shadow="jobCard" style={{ gap: s(PICK.gap) }}>
        <View style={styles.header}>
          <View style={styles.company}>
            <LogoTile
              name={job.company}
              logoUrl={job.companyLogoUrl}
              size={s(PICK.logo)}
              radius={s(PICK.logoRadius)}
              surface="brandSurface"
            />
            <Text variant="pickCardCompany" numberOfLines={1}>
              {job.company}
            </Text>
          </View>

          <View style={styles.badge}>
            {job.matchBand ? <MatchBadge band={job.matchBand} /> : null}
            <Pressable
              {...a11yButton(saveLabel)}
              accessibilityState={{ selected: job.isSaved }}
              feedback="scale"
              haptic="light"
              hitSlop={hitSlopFor(s(PICK.bookmark))}
              onPress={() => onToggleSave(job)}
            >
              <BookmarkGlyph
                saved={job.isSaved}
                size={s(PICK.bookmark)}
                color={job.isSaved ? colors.brand : colors.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        <Text variant="pickCardTitle" numberOfLines={1}>
          {job.title}
        </Text>

        {job.salary ? (
          <Text variant="pickCardSalary">
            {formatSalary({ ...job.salary, estimated: false })}
            {job.salary.estimated ? (
              <Text variant="pickCardSalaryEst" color="textSecondary">
                {' · est.'}
              </Text>
            ) : null}
          </Text>
        ) : null}

        <View style={styles.row}>
          <TagPill label={EMPLOYMENT_TYPE_LABEL[job.employmentType]} icon="Briefcase01" />
          <TagPill label={place} icon="MarkerPin01" />
          {/*
            The board writes "+3" on both picks it draws, which is each job's own tag count — the
            facts already on the card are not what it is counting. See toreview.md.
          */}
          {job.tags.length > 0 ? (
            <Text variant="caption" color="textBody">{`+${job.tags.length}`}</Text>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
});

const useStyles = scaledSheet((s) => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  company: { flexDirection: 'row', alignItems: 'center', gap: s(PICK.logoGap), flexShrink: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: s(PICK.badgeGap) },
  row: { flexDirection: 'row', alignItems: 'center', gap: s(PICK.rowGap) },
}));
