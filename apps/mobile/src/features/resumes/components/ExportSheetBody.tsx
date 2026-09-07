import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { Resume } from '@/data/models';
import type { ExportFormat } from '@/data/queries';
import { useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { SheetRow } from '@/ui/SheetRow';
import { Text } from '@/ui/Text';

import { docSubtitle } from '../docMeta';

export type ExportSheetBodyProps = {
  resume: Resume;
  plan: 'free' | 'pro';
  /** The format currently being rendered and written, or null when nothing is in flight. */
  busyFormat?: ExportFormat | null;
  onSelect: (format: ExportFormat) => void;
  /** Taken instead of `onSelect` when a locked format is tapped (V2 §13.5). */
  onUpgrade: () => void;
};

/** Figma's create sheet geometry, which this sheet reuses rather than inventing its own. */
const HEADER_TOP = 24;
const HEADER_GAP = 30;
const ROW_GAP = 28;

const noop = () => undefined;

type ExportRow = {
  format: ExportFormat;
  icon: string;
  label: string;
  description: string;
  locked: boolean;
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
      icon: 'file-pdf',
      label: 'Export as PDF',
      // §13.3: a clean PDF is never paywalled and never watermarked, on any plan.
      description: 'Clean, watermark-free — always free',
      locked: false,
    },
    {
      format: 'docx',
      icon: 'file-word',
      label: 'Export as DOCX',
      description:
        plan === 'free'
          ? 'Pro unlocks Word files for portals that ask for one'
          : 'Word file for portals that ask for one',
      locked: plan === 'free',
    },
    {
      format: 'txt',
      icon: 'file-alt',
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

function ExportSheetRow({ row, busy, inert, onPress }: RowProps) {
  const { colors, opacity, spacing } = useTheme();
  const styles = useStyles();
  const dimmed = busy || inert;

  return (
    <View style={[styles.row, { gap: spacing[3] }]}>
      <SheetRow
        icon={row.icon}
        label={row.label}
        // The hint carries the busy state, because SheetRow is one focus stop with no state slot.
        description={busy ? 'Preparing your file…' : row.description}
        locked={row.locked}
        onPress={dimmed ? noop : onPress}
        style={[styles.grow, dimmed ? { opacity: opacity.disabled } : null]}
      />
      {busy ? (
        <ActivityIndicator
          color={colors.brand}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
    </View>
  );
}

/**
 * V2 §7.12's download sheet. Fully controlled — the host owns the plan, the busy format and both
 * callbacks — so the formats and the gate can be driven in a test without the Sheet around them.
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
  const { motion, spacing, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();

  return (
    <View style={{ paddingHorizontal: spacing.gutter, paddingTop: s(HEADER_TOP) }}>
      <View style={styles.header}>
        <Text accessibilityRole="header" variant="headline" numberOfLines={1}>
          {resume.title}
        </Text>
        <Text variant="rowDescription" color="textSecondary" numberOfLines={2}>
          {docSubtitle(resume)}
        </Text>
      </View>

      <View style={{ marginTop: s(HEADER_GAP), gap: s(ROW_GAP) }}>
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
              entering={FadeInDown.delay(index * motion.stagger.row).duration(
                motion.durations.base,
              )}
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
  header: { gap: s(4) },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
}));
