import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { Resume } from '@/data/models';
import type { ExportFormat } from '@/data/queries';
import { a11yButton, useReducedMotion } from '@/lib';
import { scaledSheet, useTheme, type ColorToken } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Spinner } from '@/ui/motion';

import { docSubtitle } from '../docMeta';
import { ResumeThumbnail } from './ResumeThumbnail';
import { Icon, type LineIconName } from '@/ui/Icon';

export type ExportSheetBodyProps = {
  resume: Resume;
  plan: 'free' | 'pro';
  /** The format currently being rendered and written, or null when nothing is in flight. */
  busyFormat?: ExportFormat | null;
  onSelect: (format: ExportFormat) => void;
  /** Taken instead of `onSelect` when a locked format is tapped (V2 §13.5). */
  onUpgrade: () => void;
};

// RESUMES 11's sheet at 390 (580:1606), in artboard units.
const TOP = 16 / 0.75; // handle → header: the board's 30 less the handle and its margin
const HEADER_GAP = 12 / 0.75;
const THUMB_W = 36 / 0.75;
const THUMB_H = 46.5 / 0.75;
const THUMB_RADIUS = 7.5 / 0.75;
const TITLE_GAP = 3 / 0.75;
const HEADER_TO_ROWS = 18 / 0.75;
const ROW_GAP = 14 / 0.75;
const ROW_PAD_Y = 9 / 0.75;
const TILE = 44 / 0.75;
const TILE_RADIUS = 12 / 0.75;
const LINE_GAP = 2 / 0.75;
const PILL_GAP = 5 / 0.75;
const PILL_PAD_LEFT = 9 / 0.75;
const PILL_PAD_RIGHT = 10 / 0.75;
const PILL_PAD_Y = 4 / 0.75;
const TRAILING_SLOT = 20 / 0.75;

type ExportRow = {
  format: ExportFormat;
  icon: LineIconName;
  label: string;
  description: string;
  locked: boolean;
};

/** Each format's tile: red for PDF, blue for Word, grey for plain text (580:1622 … 580:1641). */
const TILE_LOOK: Record<ExportFormat, { bg: ColorToken; fg: ColorToken }> = {
  pdf: { bg: 'dangerSurface', fg: 'glyphDanger' },
  docx: { bg: 'tileInfo', fg: 'glyphInfo' },
  txt: { bg: 'surfaceSubtle', fg: 'textBody' },
};

/**
 * The three formats, in the order §7.12 lists them. Pure, so the copy — and the gate — can be
 * read without mounting anything.
 *
 * TXT is offered for a cover letter as well as a resume: the repo renders text for both, and
 * pasting into an application form is exactly what a letter is for.
 */
export function exportRows(plan: 'free' | 'pro'): readonly ExportRow[] {
  return [
    {
      format: 'pdf',
      icon: 'File04',
      label: 'Export as PDF',
      // §13.3: a clean PDF is never paywalled and never watermarked, on any plan.
      description: 'Clean, watermark-free — always free',
      locked: false,
    },
    {
      format: 'docx',
      icon: 'File04',
      label: 'Export as DOCX',
      description:
        plan === 'free'
          ? 'Pro unlocks Word files for portals that ask for one'
          : 'Word file for portals that ask for one',
      locked: plan === 'free',
    },
    {
      format: 'txt',
      icon: 'File06',
      label: 'Export as TXT',
      description: "Plain text for a portal's paste box",
      locked: false,
    },
  ];
}

type RowProps = {
  row: ExportRow;
  busy: boolean;
  /** True while another row is rendering: one tap, one file. */
  inert: boolean;
  onPress: () => void;
};

/** The crown-and-"Pro" pill beside a locked format's name (580:1635). */
function ProPill() {
  const { colors, radii } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.pill, { borderRadius: radii.full, backgroundColor: colors.brandSurface }]}>
      <Icon name="Star01" size="xs" color={colors.brand} />
      <Text variant="microBadge" color="brand">
        Pro
      </Text>
    </View>
  );
}

function ExportSheetRow({ row, busy, inert, onPress }: RowProps) {
  const { colors, opacity, s } = useTheme();
  const styles = useStyles();
  const dimmed = busy || inert;
  const look = TILE_LOOK[row.format];
  const description = busy ? 'Preparing your file…' : row.description;

  return (
    <Pressable
      {...a11yButton(
        row.locked ? `${row.label}, Pro feature` : row.label,
        // The hint carries the busy state, because the row is one focus stop.
        row.locked ? `${description}. Opens the Pro plans` : description,
      )}
      accessibilityState={{ disabled: dimmed, busy }}
      feedback="subtle"
      disabled={dimmed}
      onPress={onPress}
      style={[styles.row, dimmed ? { opacity: opacity.disabled } : null]}
    >
      <View style={[styles.tile, { backgroundColor: colors[look.bg] }]}>
        <Icon name={row.icon} size="lg" color={colors[look.fg]} />
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text variant="label" numberOfLines={1} style={styles.shrink}>
            {row.label}
          </Text>
          {row.locked ? <ProPill /> : null}
        </View>
        <Text variant="micro" color="textSecondary">
          {description}
        </Text>
      </View>
      {busy ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Spinner size={s(15 / 0.75)} />
        </View>
      ) : row.locked ? (
        <View style={styles.trailing}>
          <Icon name="Lock01" size="sm" color={colors.iconMuted} />
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * V2 §7.12's download sheet, drawn as RESUMES 11 (580:1606): the document's thumbnail, name and
 * what is ready, then one tinted tile per format. Fully controlled — the host owns the plan, the
 * busy format and both callbacks — so the formats and the gate can be driven in a test without
 * the Sheet around them.
 *
 * §13.5 puts the upsell *in* the locked row rather than behind an alert: the DOCX row still
 * presses, and the press routes to upgrade instead of starting an export.
 */
export function ExportSheetBody({
  resume,
  plan,
  busyFormat = null,
  onSelect,
  onUpgrade,
}: ExportSheetBodyProps) {
  const { colors, motion, sizes, spacing, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();

  return (
    <View style={{ paddingHorizontal: spacing.gutter, paddingTop: s(TOP) }}>
      <View style={styles.header}>
        <View
          style={[styles.thumb, { borderWidth: sizes.border, borderColor: colors.borderDefault }]}
        >
          <ResumeThumbnail style={styles.fill} />
        </View>
        <View style={styles.titles}>
          <Text accessibilityRole="header" variant="headline" numberOfLines={1}>
            {resume.title}
          </Text>
          <Text variant="micro" color="textSecondary" numberOfLines={2}>
            {docSubtitle(resume)}
          </Text>
        </View>
      </View>

      <View style={styles.rows}>
        {exportRows(plan).map((row, index) => {
          const content = (
            <ExportSheetRow
              row={row}
              busy={busyFormat === row.format}
              inert={busyFormat != null && busyFormat !== row.format}
              onPress={() => (row.locked ? onUpgrade() : onSelect(row.format))}
            />
          );
          // The same row stagger the create sheet runs — one sheet vocabulary, not two.
          return reduced ? (
            <View key={row.format}>{content}</View>
          ) : (
            <Animated.View
              key={row.format}
              entering={FadeInDown.delay(
                Math.min(index, motion.stagger.maxItems) * motion.stagger.row,
              ).duration(motion.durations.base)}
            >
              {content}
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: s(HEADER_GAP) },
  thumb: {
    width: s(THUMB_W),
    height: s(THUMB_H),
    borderRadius: s(THUMB_RADIUS),
    overflow: 'hidden',
  },
  fill: { flex: 1 },
  titles: { flex: 1, gap: s(TITLE_GAP) },
  rows: { marginTop: s(HEADER_TO_ROWS) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(ROW_GAP),
    paddingVertical: s(ROW_PAD_Y),
  },
  tile: {
    width: s(TILE),
    height: s(TILE),
    borderRadius: s(TILE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: s(LINE_GAP) },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: s(8 / 0.75) },
  shrink: { flexShrink: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(PILL_GAP),
    paddingLeft: s(PILL_PAD_LEFT),
    paddingRight: s(PILL_PAD_RIGHT),
    paddingVertical: s(PILL_PAD_Y),
  },
  trailing: {
    width: s(TRAILING_SLOT),
    height: s(TRAILING_SLOT),
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
