import { View } from 'react-native';

import { isBlank, type ContentEducation, type ResumeContent } from '@/data/models';
import { scaledSheet, useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';

export type ZeroDraftPreviewProps = {
  /** Null while the draft loads; the page then shows placeholder lines. */
  content: ResumeContent | null;
  name: string;
};

// ZERO 03's draft page at 390 (613:386), in artboard units.
const PAGE_W = 240 / 0.75;
const PAGE_H = 245.5 / 0.75;
const PAGE_RADIUS = 8 / 0.75;

/**
 * The page is drawn in 6.5–13pt type, below the ramp, so it is laid out at ZOOM times the board's
 * size in roles that land there and shrunk back, as TAILOR 05's preview does (ResumePagePreview).
 */
const ZOOM = 1.6;
const INNER_W = PAGE_W * ZOOM;
const INNER_H = PAGE_H * ZOOM;
const INNER_PAD = (16 / 0.75) * ZOOM;
const INNER_GAP = (4 / 0.75) * ZOOM;
const SECTION_GAP = (4 / 0.75) * ZOOM; // the 4 spacers between blocks (613:389)
const ROW_GAP_X = (4 / 0.75) * ZOOM; // 613:394
const ROW_GAP_Y = (3 / 0.75) * ZOOM;
const FLAG_PAD_X = (4 / 0.75) * ZOOM; // 613:396
const FLAG_PAD_Y = (1 / 0.75) * ZOOM;
const FLAG_RADIUS = (3 / 0.75) * ZOOM;
const FLAG_BORDER = (0.5 / 0.75) * ZOOM;
/** As drawn: the two latest roles; the page ends before a third would fit. */
const ROLES_SHOWN = 2;

/** A guess or a blank on the page: amber, dashed, so the reader sees what to check (613:396). */
function Flag({ text }: { text: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View
      style={[
        styles.flag,
        { backgroundColor: colors.warningSurface, borderColor: colors.warningAccent },
      ]}
    >
      <Text variant="microBadge" color="warningStrong" numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function EducationLine({ entry }: { entry: ContentEducation }) {
  const text = `${entry.degree} · ${entry.institution}`;
  const open = entry.needsReview === true || isBlank(entry.degree) || isBlank(entry.institution);
  return open ? (
    <Flag text={text} />
  ) : (
    <Text variant="microBadge" numberOfLines={1}>
      {text}
    </Text>
  );
}

function PageBody({ content, name }: { content: ResumeContent; name: string }) {
  const styles = useStyles();
  const roles = content.experience.slice(0, ROLES_SHOWN);

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

      <View style={styles.section}>
        <Text variant="microOverline" color="brand">
          SUMMARY
        </Text>
        <Text variant="microRegular" color="textBody" numberOfLines={3}>
          {content.summary}
        </Text>
      </View>

      {roles.length > 0 ? (
        <View style={styles.section}>
          <Text variant="microOverline" color="brand">
            EXPERIENCE
          </Text>
          {roles.map((role) => (
            <View key={role.id} style={styles.block}>
              <View style={styles.row}>
                <Text variant="microBadge" numberOfLines={1}>
                  {`${role.title} ·`}
                </Text>
                {isBlank(role.company) ? (
                  <Flag text={role.company || '[Company Name]'} />
                ) : (
                  <Text variant="microBadge" numberOfLines={1}>
                    {role.company}
                  </Text>
                )}
                {role.needsReview ? (
                  <Flag text={role.period} />
                ) : (
                  <Text variant="tiny" color="textSecondary">
                    {role.period}
                  </Text>
                )}
              </View>
              {role.bullets[0] ? (
                <Text variant="tiny" color="textSecondary" numberOfLines={1}>
                  {`• ${role.bullets[0]}`}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {content.education.length > 0 ? (
        <View style={styles.section}>
          <Text variant="microOverline" color="brand">
            EDUCATION
          </Text>
          {content.education.slice(0, 1).map((entry) => (
            <View key={entry.id} style={styles.row}>
              <EducationLine entry={entry} />
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

/**
 * ZERO 03's draft (613:386): the page as written, with every guess and blank still to check marked
 * amber — the companies, the dates, the school. It redraws as each answer lands, so the marks clear
 * one by one. Decoration to a reader: the checklist below says the same thing in words.
 */
export function ZeroDraftPreview({ content, name }: ZeroDraftPreviewProps) {
  const { colors, shadows, s } = useTheme();
  const styles = useStyles();

  return (
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
  );
}

const useStyles = scaledSheet((s) => ({
  page: {
    alignSelf: 'center',
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
  section: { marginTop: s(SECTION_GAP), gap: s(INNER_GAP) },
  block: { gap: s(INNER_GAP) },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: s(ROW_GAP_X),
    rowGap: s(ROW_GAP_Y),
  },
  flag: {
    paddingHorizontal: s(FLAG_PAD_X),
    paddingVertical: s(FLAG_PAD_Y),
    borderRadius: s(FLAG_RADIUS),
    borderWidth: s(FLAG_BORDER),
    borderStyle: 'dashed',
  },
}));
