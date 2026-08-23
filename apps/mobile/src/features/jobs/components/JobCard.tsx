import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { memo, useCallback, useMemo, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { Job } from '@/data/models';
import { a11yButton, formatJobMeta, formatSalary, hitSlopFor } from '@/lib';
import { useLayoutScale, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { LogoTile } from '@/ui/LogoTile';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

/** Top-right affordance, which is what actually differs between the three Jobs tabs. */
export type JobCardAffordance =
  /** Outline bookmark — Discover (Figma 1:332). */
  | 'save'
  /** Filled ink bookmark — Saved (Figma 1:427). */
  | 'saved'
  /** Chevron into the application — Applied (Figma 1:539). */
  | 'open';

export type JobCardProps = {
  job: Job;
  affordance?: JobCardAffordance;
  /** Pill row; each tab supplies its own (match/type/age, saved-age, or status). */
  pills: ReactNode;
  onPress: (job: Job) => void;
  /** Bookmark tap. Omitted on the Applied tab, which has no bookmark. */
  onToggleSave?: (job: Job) => void;
  /** Extra copy folded into the card's accessibility label (status, saved date…). */
  a11ySuffix?: string;
  style?: StyleProp<ViewStyle>;
};

const LOGO = 44;
const AFFORDANCE_ICON = 18;
const CHEVRON_ICON = 13;
/** Custom VoiceOver/TalkBack action that reaches the bookmark the card would otherwise swallow. */
const SAVE_ACTION = 'save';
const REMOTE_LABEL: Record<Job['remote'], string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
};

/**
 * The 472×168 list card shared by all three Jobs tabs (Figma 1:329 / 1:416 / 1:536): logo,
 * title, meta line, salary, and a pill row the caller supplies.
 */
export const JobCard = memo(function JobCard({
  job,
  affordance = 'save',
  pills,
  onPress,
  onToggleSave,
  a11ySuffix,
  style,
}: JobCardProps) {
  const { colors, spacing } = useTheme();
  const { s } = useLayoutScale();

  const meta = formatJobMeta([job.company, job.location, REMOTE_LABEL[job.remote]]);
  const salary = job.salary ? formatSalary(job.salary) : undefined;
  const label = [job.title, meta, salary, a11ySuffix].filter(Boolean).join(', ');

  const saveLabel =
    affordance === 'saved' ? `Remove ${job.title} from saved` : `Save ${job.title}`;
  const bookmarked = affordance !== 'open';

  // The card is one accessibility element by design (a screen reader should hear the whole job in
  // one focus), which is exactly why the nested bookmark is unreachable — so publish it as a custom
  // action on the card instead of trying to un-nest it.
  const actions = useMemo(
    () => (bookmarked ? [{ name: SAVE_ACTION, label: saveLabel }] : undefined),
    [bookmarked, saveLabel],
  );

  const handleAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === SAVE_ACTION) onToggleSave?.(job);
    },
    [job, onToggleSave],
  );

  return (
    <Pressable
      {...a11yButton(label)}
      accessibilityActions={actions}
      onAccessibilityAction={handleAction}
      feedback="subtle"
      haptic="light"
      onPress={() => onPress(job)}
      style={style}
    >
      <Card padding={s(19, 14)} elevated shadow="jobCard" style={{ gap: 0 }}>
        <View style={[styles.topRow, { gap: spacing[4] }]}>
          <LogoTile name={job.company} logoUrl={job.companyLogoUrl} size={s(LOGO, 36)} />

          <View style={styles.headings}>
            <Text variant="title" numberOfLines={1}>
              {job.title}
            </Text>
            <Text variant="jobMeta" color="textSecondary" numberOfLines={1}>
              {meta}
            </Text>
          </View>

          {affordance === 'open' ? (
            <FontAwesome5
              name="chevron-right"
              size={CHEVRON_ICON}
              color={colors.iconMuted}
              solid
            />
          ) : (
            <Pressable
              {...a11yButton(saveLabel)}
              accessibilityState={{ selected: affordance === 'saved' }}
              feedback="scale"
              haptic="light"
              hitSlop={hitSlopFor(AFFORDANCE_ICON)}
              onPress={() => onToggleSave?.(job)}
            >
              <FontAwesome5
                name="bookmark"
                size={AFFORDANCE_ICON}
                color={affordance === 'saved' ? colors.textPrimary : colors.iconMuted}
                solid={affordance === 'saved'}
              />
            </Pressable>
          )}
        </View>

        {salary ? (
          <Text variant="titleSm" style={{ marginTop: spacing[5] }}>
            {salary}
          </Text>
        ) : null}

        <View style={[styles.pills, { marginTop: spacing[3], gap: spacing[2] }]}>{pills}</View>
      </Card>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headings: { flex: 1 },
  pills: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
