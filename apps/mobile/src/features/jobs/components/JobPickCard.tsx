import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { memo, useCallback, useMemo } from 'react';
import { View, type AccessibilityActionEvent } from 'react-native';

import { EMPLOYMENT_TYPE_LABEL, MATCH_BAND_LABEL, type Job } from '@/data/models';
import { a11yButton, formatJobMeta, formatSalary, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { LogoTile } from '@/ui/LogoTile';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type JobPickCardProps = {
  job: Job;
  width: number;
  onPress: (job: Job) => void;
  onToggleSave: (job: Job) => void;
};

const LOGO = 40;
const BOOKMARK = 17;
/** Custom VoiceOver/TalkBack action that reaches the bookmark the card would otherwise swallow. */
const SAVE_ACTION = 'save';
const REMOTE_LABEL: Record<Job['remote'], string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
};

/**
 * Figma 1:301 — the 300×208 "Today's picks" card. Narrower than the list card, with a smaller
 * logo and a two-pill row (match + employment type, no age).
 */
export const JobPickCard = memo(function JobPickCard({
  job,
  width,
  onPress,
  onToggleSave,
}: JobPickCardProps) {
  const { colors, radii, spacing, s } = useTheme();
  const styles = useStyles();

  const meta = formatJobMeta([job.company, job.location, REMOTE_LABEL[job.remote]]);
  const salary = job.salary ? formatSalary(job.salary) : undefined;
  const saveLabel = job.isSaved ? `Remove ${job.title} from saved` : `Save ${job.title}`;

  // The card stays a single accessibility element, so the nested bookmark is published as a custom
  // action on it rather than left unreachable behind the collapsed subtree.
  const actions = useMemo(() => [{ name: SAVE_ACTION, label: saveLabel }], [saveLabel]);

  const handleAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === SAVE_ACTION) onToggleSave(job);
    },
    [job, onToggleSave],
  );

  return (
    <Pressable
      {...a11yButton([job.title, meta, salary].filter(Boolean).join(', '))}
      accessibilityActions={actions}
      onAccessibilityAction={handleAction}
      feedback="scale"
      haptic="light"
      onPress={() => onPress(job)}
      style={{ width }}
    >
      <Card padding={s(17)} elevated shadow="jobCard" style={{ gap: 0 }}>
        <View style={styles.topRow}>
          <LogoTile name={job.company} logoUrl={job.companyLogoUrl} size={s(LOGO)} />
          <Pressable
            {...a11yButton(saveLabel)}
            accessibilityState={{ selected: job.isSaved }}
            feedback="scale"
            haptic="light"
            hitSlop={hitSlopFor(BOOKMARK)}
            onPress={() => onToggleSave(job)}
          >
            <FontAwesome5
              name="bookmark"
              size={s(BOOKMARK)}
              color={job.isSaved ? colors.textPrimary : colors.iconMuted}
              solid={job.isSaved}
            />
          </Pressable>
        </View>

        <Text variant="title" numberOfLines={1} style={{ marginTop: spacing[3] }}>
          {job.title}
        </Text>
        <Text variant="jobMeta" color="textSecondary" numberOfLines={1} style={{ marginTop: s(4) }}>
          {meta}
        </Text>
        {salary ? (
          <Text variant="titleSm" style={{ marginTop: s(4) }}>
            {salary}
          </Text>
        ) : null}

        <View style={[styles.pills, { marginTop: spacing[3], gap: spacing[2] }]}>
          {job.matchBand ? (
            <View
              style={[
                styles.pill,
                {
                  borderRadius: radii.full,
                  backgroundColor:
                    job.matchBand === 'strong' ? colors.successSurface : colors.warningSurface,
                },
              ]}
            >
              <Text
                variant="pillStrong"
                color={job.matchBand === 'strong' ? 'success' : 'warningStrong'}
              >
                {MATCH_BAND_LABEL[job.matchBand]}
              </Text>
            </View>
          ) : null}
          <View
            style={[
              styles.pill,
              { borderRadius: radii.full, backgroundColor: colors.surfaceSubtle },
            ]}
          >
            <Text variant="pill" color="textSecondary">
              {EMPLOYMENT_TYPE_LABEL[job.employmentType]}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
});

const useStyles = scaledSheet((s) => ({
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  pills: { flexDirection: 'row', alignItems: 'center' },
  pill: { paddingHorizontal: s(12), paddingVertical: s(5) },
}));
