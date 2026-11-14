import { View } from 'react-native';

import {
  EMPLOYMENT_TYPE_LABEL,
  JD_CLOSED_TITLE,
  type JdFact,
  type JdIssue,
  type JdStructured,
} from '@/data/models';
import {
  WORK_MODE_LABEL,
  experienceText,
  locationText,
  payLabel,
  scheduleText,
} from '@/data/models/jd';
import { a11yHeader } from '@/lib';
import { ProfileCard } from '@/features/profile/components/cards';
import { scaledSheet, useTheme } from '@/theme';
import { Icon, type LineIconName } from '@/ui/Icon';
import { Pill } from '@/ui/Pill';
import { Text } from '@/ui/Text';

import { JdSourceQuotes } from './JdSourceQuotes';

type Fact = {
  key: string;
  label: string;
  value: string;
  icon: LineIconName;
  facts: readonly (JdFact<unknown> | undefined)[];
};

const quotesOf = (facts: Fact['facts']) =>
  facts
    .flatMap((f) => f?.quotes ?? [])
    .filter((q, i, all) => all.findIndex((o) => o.start === q.start) === i);

/** The facts a reader looks for first, only those the job states (toreview §153). */
function factsOf(s: JdStructured): Fact[] {
  const pay = payLabel(s);
  const years = experienceText(s.experience);
  const place = locationText(s);
  const days = scheduleText(s);
  const out: (Fact | null)[] = [
    pay
      ? {
          key: 'pay',
          label: 'Salary',
          value: pay,
          icon: 'CreditCard01',
          facts: [s.compensation.range],
        }
      : null,
    years
      ? {
          key: 'years',
          label: 'Experience',
          value: years,
          icon: 'Clock',
          facts: [s.experience.minYears, s.experience.freshersOk],
        }
      : null,
    s.identity.employmentType
      ? {
          key: 'type',
          label: 'Employment',
          value: EMPLOYMENT_TYPE_LABEL[s.identity.employmentType.value],
          icon: 'Briefcase01',
          facts: [s.identity.employmentType],
        }
      : null,
    s.workMode
      ? {
          key: 'mode',
          label: 'Work mode',
          value: WORK_MODE_LABEL[s.workMode.value],
          icon: 'Building02',
          facts: [s.workMode],
        }
      : null,
    place
      ? { key: 'place', label: 'Location', value: place, icon: 'MarkerPin01', facts: s.locations }
      : null,
    days
      ? { key: 'days', label: 'Schedule', value: days, icon: 'Calendar', facts: s.schedule }
      : null,
  ];
  return out.filter((f): f is Fact => f !== null);
}

/**
 * The job's key facts (toreview §154, mobile's side of the web's grid), spec-derived from the
 * profile cards: one row each, its source a tap away, an unclear one marked rather than picked.
 */
export function JdFactsCard({ s }: { s: JdStructured }) {
  const { colors, spacing } = useTheme();
  const styles = useStyles();
  const facts = factsOf(s);
  if (facts.length === 0) return null;

  return (
    <ProfileCard style={{ padding: spacing[4], gap: spacing[4] }}>
      <Text {...a11yHeader()} variant="title3" color="ink">
        Key facts
      </Text>
      {facts.map((f) => (
        <View key={f.key} style={[styles.row, { gap: spacing[3] }]}>
          <Icon name={f.icon} size="sm" color={colors.iconMuted} />
          <View style={[styles.text, { gap: spacing[1] }]}>
            <Text variant="caption" color="textSecondary">
              {f.label}
            </Text>
            <Text variant="bodySemiBold" selectable>
              {f.value}
            </Text>
            {f.facts.some((x) => x?.status === 'unclear') ? (
              <Pill label="Unclear in the job" tone="warning" style={styles.pill} />
            ) : null}
            <JdSourceQuotes quotes={quotesOf(f.facts)} label={f.label.toLowerCase()} />
          </View>
        </View>
      ))}
    </ProfileCard>
  );
}

/**
 * "Worth knowing" (toreview §153–§154): where the job contradicts itself or is unclear, in plain
 * words with its own quotes. Nothing is decided for the reader. Nothing to say draws nothing.
 */
export function JdWorthKnowing({ issues }: { issues: readonly JdIssue[] }) {
  const { colors, radii, spacing } = useTheme();
  const styles = useStyles();
  if (issues.length === 0) return null;
  // A closed posting leads, under its own heading (toreview §206).
  const closed = issues.some((issue) => issue.kind === 'expired');
  const ordered = closed
    ? [...issues].sort((a, b) => Number(b.kind === 'expired') - Number(a.kind === 'expired'))
    : issues;

  return (
    <View
      style={{
        gap: spacing[3],
        padding: spacing[4],
        borderRadius: radii.card,
        backgroundColor: colors.warningSurface,
      }}
    >
      <View style={[styles.line, { gap: spacing[2] }]}>
        <Icon name="AlertTriangle" size="sm" color={colors.warningStrong} />
        <Text {...a11yHeader()} variant="captionSemiBold" color="warningStrong">
          {closed ? JD_CLOSED_TITLE : 'Worth knowing'}
        </Text>
      </View>
      {ordered.map((issue) => (
        <View key={`${issue.field}:${issue.note}`} style={{ gap: spacing[1] }}>
          <Text
            variant="caption"
            color={issue.kind === 'sensitive' ? 'textSecondary' : 'textPrimary'}
          >
            {issue.note}
          </Text>
          {issue.kind !== 'sensitive' ? (
            <JdSourceQuotes quotes={issue.quotes} label="this" />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  text: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'center' },
  pill: { alignSelf: 'flex-start' },
}));
