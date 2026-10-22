import { memo, useCallback, useMemo } from 'react';
import { View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native';

import type { Application, Job } from '@/data/models';
import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { LogoTile } from '@/ui/LogoTile';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { JobCardFooter } from './JobCardFooter';
import { appliedCardLabel, jobCardLabel, jobTags, type FooterNote } from './jobCardMeta';
import { ApplicationStatusPill, MatchBadge, TagPill } from './JobPills';
import { MatchReason } from './MatchReason';

/** Which tab the card is standing in, which is what decides its badge and its footer. */
/**
 * `company` is an open role on the company page (JOBS 09 580:1707): the match badge, no reason,
 * and a chevron footer — the row is a way into the job, not a place to act on it.
 */
export type JobCardVariant = 'discover' | 'saved' | 'applied' | 'company';

export type JobCardProps = {
  job: Job;
  variant?: JobCardVariant;
  /** Required by the `applied` variant, which shows its status in place of the match badge. */
  application?: Application;
  /** Footer copy and its colour; built by `jobCardMeta` so the card stays presentational. */
  footer: FooterNote;
  onPress: (job: Job) => void;
  onToggleSave?: (job: Job) => void;
  /** The footer's "Tailor with AI" button (Figma 498:34). Absent on the Applied tab. */
  onTailor?: (job: Job) => void;
  style?: StyleProp<ViewStyle>;
};

/** Drawn values over 0.75: a 14 pad, 18 radius, 10 between blocks, a 33 logo 9 from its name. */
// The 18 radius the board draws is `radii.cardLg` already, so `Card`'s default carries it.
const CARD = { padding: 18.6667, gap: 13.3333, logo: 44, logoGap: 12, tagGap: 8 };
/** Custom VoiceOver/TalkBack action that reaches the bookmark the card would otherwise swallow. */
const SAVE_ACTION = 'save';
const TAILOR_ACTION = 'tailor';

/**
 * The job list card, redrawn across all three Jobs tabs (Figma 498:2 Discover, 521:2 Saved,
 * 521:236 Applied).
 *
 * One shape, three variants. Company and badge on a header row, the title on its own line, every
 * fact about the job as a tag, then — where there is one — the match reason, a rule, and a footer.
 * What changes per tab is the badge (match band, or application status) and the footer (tailor and
 * bookmark, or a chevron into the application).
 *
 * The card stays a single accessibility element: everything it draws is folded into one label and
 * the two buttons are published as custom actions, because a screen reader should hear a whole job
 * in one focus rather than walk four pills and a sparkle.
 */
export const JobCard = memo(function JobCard({
  job,
  variant = 'discover',
  application,
  footer,
  onPress,
  onToggleSave,
  onTailor,
  style,
}: JobCardProps) {
  const { colors, s } = useTheme();
  const styles = useStyles();

  const applied = variant === 'applied';
  /** Applied and company rows lead into a page rather than carrying the two footer buttons. */
  const chevron = applied || variant === 'company';
  const saveLabel = job.isSaved ? `Remove ${job.title} from saved` : `Save ${job.title}`;
  const tailorLabel = `Tailor a resume for ${job.title}`;
  const label =
    applied && application
      ? appliedCardLabel(job, application, footer.note)
      : jobCardLabel(job, footer.note);

  const actions = useMemo(
    () =>
      chevron
        ? undefined
        : [
            { name: SAVE_ACTION, label: saveLabel },
            { name: TAILOR_ACTION, label: tailorLabel },
          ],
    [chevron, saveLabel, tailorLabel],
  );

  const handleAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const { actionName } = event.nativeEvent;
      if (actionName === SAVE_ACTION) onToggleSave?.(job);
      if (actionName === TAILOR_ACTION) onTailor?.(job);
    },
    [job, onTailor, onToggleSave],
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
      <Card padding={s(CARD.padding)} elevated shadow="jobCard" style={{ gap: s(CARD.gap) }}>
        <View style={styles.header}>
          <View style={styles.company}>
            <LogoTile name={job.company} logoUrl={job.companyLogoUrl} size={s(CARD.logo)} />
            <Text variant="jobListCompany" numberOfLines={1}>
              {job.company}
            </Text>
          </View>
          {applied && application ? (
            <ApplicationStatusPill application={application} />
          ) : job.matchBand ? (
            <MatchBadge band={job.matchBand} />
          ) : null}
        </View>

        <Text variant="jobListTitle" numberOfLines={2}>
          {job.title}
        </Text>

        <View style={styles.tags}>
          {jobTags(job).map((tag) => (
            <TagPill key={tag} label={tag} />
          ))}
        </View>

        {!chevron && job.matchReason ? <MatchReason reason={job.matchReason} /> : null}

        <View style={[styles.rule, { backgroundColor: colors.borderHairline }]} />

        <JobCardFooter
          note={footer.note}
          noteColor={footer.noteColor}
          variant={chevron ? 'chevron' : 'actions'}
          saved={job.isSaved}
          saveLabel={saveLabel}
          tailorLabel={tailorLabel}
          onTailor={() => onTailor?.(job)}
          onToggleSave={() => onToggleSave?.(job)}
        />
      </Card>
    </Pressable>
  );
}, sameCard);

/**
 * Shallow equality, except that the footer is compared by value: callers build it per render
 * (`discoverNote(job)` inside `renderItem`), so by identity the memo above would never hold and
 * every visible card would re-render with the list.
 */
function sameCard(prev: JobCardProps, next: JobCardProps): boolean {
  return (
    prev.job === next.job &&
    prev.variant === next.variant &&
    prev.application === next.application &&
    prev.footer.note === next.footer.note &&
    prev.footer.noteColor === next.footer.noteColor &&
    prev.onPress === next.onPress &&
    prev.onToggleSave === next.onToggleSave &&
    prev.onTailor === next.onTailor &&
    prev.style === next.style
  );
}

const useStyles = scaledSheet((s) => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  company: { flexDirection: 'row', alignItems: 'center', gap: s(CARD.logoGap), flexShrink: 1 },
  tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: s(CARD.tagGap) },
  rule: { height: s(1) },
}));
