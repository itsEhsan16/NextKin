import { View } from 'react-native';

import type { JdDraft } from '@/data/models';
import { a11yButton, initialOf, pluralize } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Icon, type LineIconName } from '@/ui/Icon';
import { FlowCard } from '@/ui/kit';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

/** One fact chip at the top of the job: "₹30–40 LPA", "Hybrid", "Bengaluru". */
export type JdHeroFact = { icon: LineIconName; label: string };

export type BuildReviewCardProps = {
  draft: JdDraft;
  asks: readonly string[];
  /** The job's key facts as chips under the title, in the order the page should read them. */
  facts?: readonly JdHeroFact[];
  onEdit?: () => void;
};

export const draftMetaLine = (draft: JdDraft): string =>
  [draft.company, draft.location].filter(Boolean).join(' · ');

/**
 * The top of the job description page (owner, 2026-11-08: "make the job description better",
 * §180): the company's tile and line, the role as the page's title, its key facts as chips, then
 * what the job asks for as brand chips in their own card. The pencil corrects what was read, as
 * before (it opens the review form); a structured job, read whole, has none.
 */
export function BuildReviewCard({ draft, asks, facts = [], onEdit }: BuildReviewCardProps) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  const meta = draftMetaLine(draft);
  const name = draft.company ?? draft.title;

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <View
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[
            styles.tile,
            { backgroundColor: colors.surfaceCard, borderColor: colors.borderSoft },
          ]}
        >
          <Text variant="title2" color="brand">
            {initialOf(name)}
          </Text>
        </View>
        <Text variant="callout" color="textSecondary" numberOfLines={1} style={styles.flex}>
          {meta || 'Job you added'}
        </Text>
        {onEdit ? (
          <Pressable
            {...a11yButton('Edit the job details', 'Correct what we read from the job')}
            feedback="subtle"
            onPress={onEdit}
            style={[
              styles.edit,
              { backgroundColor: colors.surfaceCard, borderColor: colors.borderSoft },
            ]}
          >
            <Icon name="Edit03" size={u(16)} color={colors.ink} />
            <Text variant="footnote" color="ink">
              Edit
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Text
        variant="title1"
        color="ink"
        accessibilityRole="header"
        accessibilityLabel={meta ? `${draft.title}, ${meta}` : draft.title}
      >
        {draft.title}
      </Text>

      {facts.length > 0 ? (
        <View style={styles.facts}>
          {facts.map((fact) => (
            <View
              key={`${fact.icon}:${fact.label}`}
              style={[
                styles.fact,
                { backgroundColor: colors.surfaceCard, borderColor: colors.borderSoft },
              ]}
            >
              <Icon name={fact.icon} size={u(15)} color={colors.brand} />
              <Text variant="footnote" color="ink" numberOfLines={1}>
                {fact.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <FlowCard style={styles.asks}>
        <Text variant="title3" color="ink">
          {asks.length > 0
            ? `Skills it asks for · ${pluralize(asks.length, 'skill')}`
            : 'Skills it asks for'}
        </Text>
        {asks.length > 0 ? (
          <View style={styles.chips}>
            {asks.map((label) => (
              <View key={label} style={[styles.chip, { backgroundColor: colors.brandSurface }]}>
                <Text variant="footnote" color="brand" numberOfLines={1}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text variant="callout" color="textSecondary">
            We didn&apos;t find any skills in this job. Your resume will follow its description.
          </Text>
        )}
      </FlowCard>
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  wrap: { gap: u(14) },
  top: { flexDirection: 'row', alignItems: 'center', gap: u(12) },
  tile: {
    width: u(52),
    height: u(52),
    borderRadius: u(16),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  edit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(6),
    height: u(36),
    paddingHorizontal: u(14),
    borderRadius: u(999),
    borderWidth: 1,
  },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8) },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(6),
    paddingHorizontal: u(12),
    paddingVertical: u(7),
    borderRadius: u(999),
    borderWidth: 1,
  },
  asks: { gap: u(12), marginTop: u(6), padding: u(18) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8) },
  chip: { paddingHorizontal: u(12), paddingVertical: u(7), borderRadius: u(999) },
}));
