import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';

import type { Resume } from '@/data/models';
import { a11yButton } from '@/lib';
import { scaledSheet, useTheme, type ColorToken } from '@/theme';
import { AiBadge } from '@/ui/AiBadge';
import { ConfirmSheetBody } from '@/ui/ConfirmSheet';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { docSubtitle } from '../docMeta';
import type { ResumeMenuStep } from '../resumesStore';
import { ResumeThumbnail } from './ResumeThumbnail';

export type ResumeMenuSheetBodyProps = {
  resume: Resume;
  step: ResumeMenuStep;
  deleting: boolean;
  onRename: () => void;
  onDuplicate: () => void;
  onTailor: () => void;
  onSetAsBase: () => void;
  onDownload: () => void;
  onShare: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

const ICON = 17;
const ICON_SLOT = 24;
const ROW_HEIGHT = 56;
const THUMB = { width: 48, height: 62 } as const;

type MenuRowProps = {
  icon: string;
  label: string;
  /** Muted right-hand caption ("PDF · DOCX", "Asks to confirm"). */
  detail?: string;
  tone?: 'default' | 'brand' | 'danger';
  ai?: boolean;
  hint?: string;
  onPress: () => void;
};

function MenuRow({ icon, label, detail, tone = 'default', ai, hint, onPress }: MenuRowProps) {
  const { colors, spacing, s } = useTheme();
  const styles = useStyles();
  const color: ColorToken = tone === 'brand' ? 'brand' : tone === 'danger' ? 'danger' : 'textBody';
  const labelColor: ColorToken =
    tone === 'brand' ? 'brand' : tone === 'danger' ? 'danger' : 'textPrimary';

  return (
    <Pressable
      {...a11yButton(ai ? `${label}, AI powered` : label, hint)}
      feedback="subtle"
      haptic="light"
      onPress={onPress}
      style={[styles.row, { minHeight: s(ROW_HEIGHT), gap: spacing[3] }]}
    >
      <View style={styles.iconSlot}>
        <FontAwesome5 name={icon} size={s(ICON)} color={colors[color]} solid />
      </View>
      <Text variant="menuRow" color={labelColor} numberOfLines={1}>
        {label}
      </Text>
      {ai ? <AiBadge /> : null}
      <View style={styles.spacer} />
      {detail ? (
        <Text variant="caption" color={tone === 'danger' ? 'textTertiary' : 'textSecondary'}>
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * RESUMES 03 (Figma 1:2020) — the ⋯ / long-press action sheet for one document. Fully
 * controlled so tests drive it without the Sheet. Delete swaps the whole body for an inline
 * confirm (the artboard's "Asks to confirm"); the host animates the sheet height between them.
 */
export function ResumeMenuSheetBody({
  resume,
  step,
  deleting,
  onRename,
  onDuplicate,
  onTailor,
  onSetAsBase,
  onDownload,
  onShare,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: ResumeMenuSheetBodyProps) {
  const { colors, spacing, s } = useTheme();
  const styles = useStyles();

  if (step === 'confirm-delete') {
    const coverLetter = resume.docType === 'cover_letter';
    return (
      <ConfirmSheetBody
        title={coverLetter ? 'Delete this cover letter?' : 'Delete this resume?'}
        message={`"${resume.title}" and its version history will be gone for good. Downloads you already saved are not affected.`}
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
    );
  }

  const isResume = resume.docType === 'resume';

  return (
    <View style={{ paddingHorizontal: spacing.gutter }}>
      <View style={[styles.header, { gap: spacing[4], paddingVertical: spacing[4] }]}>
        <View
          style={{
            width: s(THUMB.width),
            height: s(THUMB.height),
            borderRadius: s(10),
            borderWidth: s(1),
            borderColor: colors.borderDefault,
            overflow: 'hidden',
          }}
        >
          <ResumeThumbnail style={StyleSheet.absoluteFill} />
        </View>
        <View style={styles.headerText}>
          <Text variant="title" numberOfLines={1}>
            {resume.title}
          </Text>
          <Text variant="rowDescription" color="textSecondary" numberOfLines={1}>
            {docSubtitle(resume)}
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.divider }]} />

      <MenuRow icon="edit" label="Rename" onPress={onRename} />
      <MenuRow icon="copy" label="Duplicate" onPress={onDuplicate} />
      {isResume ? (
        <MenuRow
          icon="magic"
          label="Tailor to a job"
          tone="brand"
          ai
          hint="Creates a job-specific copy"
          onPress={onTailor}
        />
      ) : null}
      {isResume && !resume.isBase ? (
        <MenuRow
          icon="star"
          label="Set as base"
          hint="New tailored copies start from the base"
          onPress={onSetAsBase}
        />
      ) : null}
      <MenuRow icon="download" label="Download" detail="PDF · DOCX" onPress={onDownload} />
      <MenuRow icon="link" label="Share link" onPress={onShare} />

      <View style={[styles.divider, { backgroundColor: colors.divider, marginTop: spacing[2] }]} />

      <MenuRow
        icon="trash"
        label="Delete"
        detail="Asks to confirm"
        tone="danger"
        onPress={onRequestDelete}
      />
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  header: { flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1, gap: s(2) },
  divider: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconSlot: { width: ICON_SLOT, alignItems: 'center' },
  spacer: { flex: 1 },
}));
