import { View } from 'react-native';

import { SCORE_LABEL, SCORE_LABEL_CAPS, type ResumeContent } from '@/data/models';
import { atsScoreColor } from '@/features/resumes';
import { scaledSheet, useTheme } from '@/theme';
import { ScoreRing } from '@/ui/Progress';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';

export type ResumePagePreviewProps = {
  /** Null while the document loads; the page then shows placeholder lines. */
  content: ResumeContent | null;
  name: string;
  /** The finished score; the badge waits for it. */
  score?: number;
};

// TAILOR 05's preview stage at 390 (608:274), in artboard units.
const STAGE_H = 318 / 0.75;
const PAGE_TOP = 6 / 0.75;
const PAGE_W = 232 / 0.75;
const PAGE_H = 306 / 0.75;
const PAGE_RADIUS = 10 / 0.75;
const BADGE = 78 / 0.75;
/** The badge's offset from the page's own top-left corner (250 − 61, 0 − 6). */
const BADGE_LEFT = 189 / 0.75;
const BADGE_TOP = -6 / 0.75;
const RING = 66 / 0.75;
const RING_STROKE = 4.95 / 0.75;
const WASH_RADIUS = 4 / 0.75;

/**
 * The page is drawn in 5.8–13pt type, below every role on the ramp. It is laid out at ZOOM times
 * the board's size in roles that land there (13 → 20.8 pageTitle, 7.2 → 11.5 microBadge, 5.8–6.2
 * → 9.3–9.9 tiny/microOverline) and shrunk back by 1 / ZOOM, so the thumbnail keeps the ramp.
 */
const ZOOM = 1.6;
const INNER_W = PAGE_W * ZOOM;
const INNER_H = PAGE_H * ZOOM;
const INNER_PAD = (16 / 0.75) * ZOOM;
const INNER_GAP = (4 / 0.75) * ZOOM;
const WASH_PAD_X = (4 / 0.75) * ZOOM;
const WASH_PAD_Y = (3 / 0.75) * ZOOM;

/** "https://georgesmith.design/" → "georgesmith.design", as a printed contact line shows it. */
const bareLink = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

function PageBody({ content, name }: { content: ResumeContent; name: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const contact = [content.contact?.email, content.contact?.location, content.links?.[0]]
    .filter((part): part is string => Boolean(part))
    .map(bareLink)
    .join(' · ');
  // As drawn: the latest role with two bullets, the one before it with one.
  const roles = content.experience.slice(0, 2);

  return (
    <>
      <Text variant="pageTitle" numberOfLines={1}>
        {name}
      </Text>
      {content.headline ? (
        <Text variant="microBadge" color="brand" numberOfLines={1}>
          {content.headline}
        </Text>
      ) : null}
      {contact ? (
        <Text variant="tiny" color="textSecondary" numberOfLines={1}>
          {contact}
        </Text>
      ) : null}
      <View style={[styles.rule, { backgroundColor: colors.borderHairline }]} />
      {content.summary ? (
        <>
          <Text variant="microOverline" color="brand">
            SUMMARY
          </Text>
          <View style={[styles.wash, { backgroundColor: colors.brandSurface }]}>
            <Text variant="tiny" color="textBody" numberOfLines={4}>
              {content.summary}
            </Text>
          </View>
        </>
      ) : null}
      {roles.length > 0 ? (
        <Text variant="microOverline" color="brand">
          EXPERIENCE
        </Text>
      ) : null}
      {roles.map((role, index) => (
        <View key={role.id} style={styles.role}>
          <Text variant="microBadge" numberOfLines={1}>
            {`${role.title} · ${role.company}`}
          </Text>
          <Text variant="tiny" color="textSecondary">
            {role.period}
          </Text>
          {role.bullets.slice(0, index === 0 ? 2 : 1).map((bullet) => (
            <Text key={bullet} variant="tiny" color="textBody" numberOfLines={2}>
              {`• ${bullet}`}
            </Text>
          ))}
        </View>
      ))}
      {content.skills.length > 0 ? (
        <>
          <Text variant="microOverline" color="brand">
            SKILLS
          </Text>
          <Text variant="tiny" color="textBody" numberOfLines={2}>
            {content.skills.join(' · ')}
          </Text>
        </>
      ) : null}
    </>
  );
}

/**
 * TAILOR 05's thumbnail of the tailored resume (608:275): a read-only page with the tailored
 * summary washed lavender, and the score badge overlapping its top-right corner (608:293).
 * Decorative to a reader apart from the score, which the badge speaks.
 */
export function ResumePagePreview({ content, name, score }: ResumePagePreviewProps) {
  const { colors, shadows, s } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.stage}>
      <View style={styles.anchor}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.page,
            shadows.docFloat,
            { backgroundColor: colors.surfaceCard, borderColor: colors.borderHairline },
          ]}
        >
          <View style={styles.inner}>
            {content ? (
              <PageBody content={content} name={name} />
            ) : (
              [0, 1, 2, 3, 4, 5].map((row) => (
                <Skeleton key={row} width={row === 0 ? '60%' : '100%'} height={s(INNER_GAP * 3)} />
              ))
            )}
          </View>
        </View>
        {score != null ? (
          <View style={[styles.badge, shadows.docFloat, { backgroundColor: colors.surfaceCard }]}>
            <ScoreRing
              score={score}
              label={SCORE_LABEL_CAPS}
              size={s(RING)}
              strokeWidth={s(RING_STROKE)}
              ringColor={atsScoreColor(score)}
              trackColor="borderDefault"
              numberVariant="homeRingValue"
              numberColor="textPrimary"
              labelVariant="microOverline"
              labelColor="textSecondary"
              accessibilityLabel={`${SCORE_LABEL} ${score}`}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  stage: { height: s(STAGE_H), alignItems: 'center' },
  anchor: { marginTop: s(PAGE_TOP), width: s(PAGE_W), height: s(PAGE_H) },
  page: {
    width: s(PAGE_W),
    height: s(PAGE_H),
    borderRadius: s(PAGE_RADIUS),
    borderWidth: s(1),
    overflow: 'hidden',
  },
  inner: {
    width: s(INNER_W),
    height: s(INNER_H),
    padding: s(INNER_PAD),
    gap: s(INNER_GAP),
    transform: [{ scale: 1 / ZOOM }],
    transformOrigin: 'top left',
  },
  rule: { height: s(1) * ZOOM, alignSelf: 'stretch' },
  wash: {
    borderRadius: s(WASH_RADIUS) * ZOOM,
    paddingHorizontal: s(WASH_PAD_X),
    paddingVertical: s(WASH_PAD_Y),
  },
  role: { gap: s(INNER_GAP) },
  badge: {
    position: 'absolute',
    left: s(BADGE_LEFT),
    top: s(BADGE_TOP),
    width: s(BADGE),
    height: s(BADGE),
    borderRadius: s(BADGE) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
