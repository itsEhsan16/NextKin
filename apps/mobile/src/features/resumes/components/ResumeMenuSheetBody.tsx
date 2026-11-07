import type { FC } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';

import type { Resume } from '@/data/models';
import { a11yButton } from '@/lib';
import { scaledSheet, useTheme, type ColorToken } from '@/theme';
import { AiBadge } from '@/ui/AiBadge';
import { ConfirmSheetBody } from '@/ui/ConfirmSheet';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { docSubtitle } from '../docMeta';
import type { ResumeMenuStep } from '../resumesStore';
import DeleteIcon from '../../../../assets/icons/doc-menu/delete.svg';
import DownloadIcon from '../../../../assets/icons/doc-menu/download.svg';
import RenameIcon from '../../../../assets/icons/doc-menu/rename.svg';
import SetBaseIcon from '../../../../assets/icons/doc-menu/set-base.svg';
import ShareIcon from '../../../../assets/icons/doc-menu/share.svg';
import DuplicateIcon from '../../../../assets/icons/create/new-resume.svg';
import TailorIcon from '../../../../assets/icons/create/tailor.svg';
import { RenameSheetPane } from './RenameSheetPane';
import { ResumeThumbnail } from './ResumeThumbnail';

export type ResumeMenuSheetBodyProps = {
  resume: Resume;
  step: ResumeMenuStep;
  deleting: boolean;
  /** The rename mutation is in flight; the Save button owns the spinner. */
  renaming: boolean;
  /** Switches the sheet to its rename step — renaming is a title edit, not a screen (V2 §7.11). */
  onRename: () => void;
  /** Receives the trimmed title. */
  onSubmitRename: (title: string) => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onTailor: () => void;
  onSetAsBase: () => void;
  onDownload: () => void;
  onShare: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

const THUMB = { width: 48, height: 62 } as const;
/**
 * Each row leads with a 39-wide multi-tone icon, tile drawn in (Figma 497:17 … 497:132), on a
 * 52 pitch at 390 — 52 and 69⅓ in artboard units. `h` is the icon's own drawn height over 0.75;
 * Rename is a touch shorter than square and none is stretched to match.
 */
const ICON = 52;
const ROW_PAD = (52 - 39) / 2 / 0.75;
/** Dividers 95:2234 / 95:2257 sit ~9.5 off the neighbouring rows at 390. */
const DIVIDER_GAP = 12;

type MenuIcon = { Icon: FC<SvgProps>; h: number };

const ICONS = {
  rename: { Icon: RenameIcon, h: 38.16 / 0.75 },
  duplicate: { Icon: DuplicateIcon, h: 38.907 / 0.75 },
  tailor: { Icon: TailorIcon, h: 38.9951 / 0.75 },
  setBase: { Icon: SetBaseIcon, h: ICON },
  download: { Icon: DownloadIcon, h: ICON },
  share: { Icon: ShareIcon, h: ICON },
  delete: { Icon: DeleteIcon, h: ICON },
} satisfies Record<string, MenuIcon>;

type MenuRowProps = {
  icon: MenuIcon;
  label: string;
  /** Muted right-hand caption ("PDF · DOCX", "Asks to confirm"). */
  detail?: string;
  tone?: 'default' | 'brand' | 'danger';
  ai?: boolean;
  hint?: string;
  onPress: () => void;
};

function MenuRow({ icon, label, detail, tone = 'default', ai, hint, onPress }: MenuRowProps) {
  const { sizes, spacing, s } = useTheme();
  const styles = useStyles();
  const labelColor: ColorToken =
    tone === 'brand' ? 'brand' : tone === 'danger' ? 'danger' : 'textPrimary';

  return (
    <Pressable
      {...a11yButton(ai ? `${label}, AI powered` : label, hint)}
      feedback="subtle"
      onPress={onPress}
      // The token, not the drawn 56: a local constant takes the flat factor and landed at 42dp.
      style={[
        styles.row,
        { minHeight: sizes.listRow, paddingVertical: s(ROW_PAD), gap: spacing[4] },
      ]}
    >
      <View style={styles.iconSlot}>
        <icon.Icon width={s(ICON)} height={s(icon.h)} />
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
 * RESUMES 03 (Figma 95:2221) — the ⋯ / long-press action sheet for one document. Fully
 * controlled so tests drive it without the Sheet. Rename and delete each swap the whole body
 * for their own pane (the artboard's "Asks to confirm"); the host animates the sheet height
 * between them.
 */
export function ResumeMenuSheetBody({
  resume,
  step,
  deleting,
  renaming,
  onRename,
  onSubmitRename,
  onCancelRename,
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

  if (step === 'rename') {
    return (
      <RenameSheetPane
        key={resume.id}
        resume={resume}
        renaming={renaming}
        onSubmit={onSubmitRename}
        onCancel={onCancelRename}
      />
    );
  }

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

      <View
        style={[styles.divider, { backgroundColor: colors.divider, marginBottom: s(DIVIDER_GAP) }]}
      />

      <MenuRow icon={ICONS.rename} label="Rename" onPress={onRename} />
      <MenuRow icon={ICONS.duplicate} label="Duplicate" onPress={onDuplicate} />
      {isResume ? (
        <MenuRow
          icon={ICONS.tailor}
          label="Tailor to a job"
          tone="brand"
          ai
          hint="Creates a job-specific copy"
          onPress={onTailor}
        />
      ) : null}
      {isResume && !resume.isBase ? (
        <MenuRow
          icon={ICONS.setBase}
          label="Set as base"
          hint="New tailored copies start from the base"
          onPress={onSetAsBase}
        />
      ) : null}
      <MenuRow icon={ICONS.download} label="Download" detail="PDF · DOCX" onPress={onDownload} />
      <MenuRow icon={ICONS.share} label="Share link" onPress={onShare} />

      <View
        style={[
          styles.divider,
          {
            backgroundColor: colors.divider,
            marginVertical: s(DIVIDER_GAP),
          },
        ]}
      />

      <MenuRow
        icon={ICONS.delete}
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
  iconSlot: { width: s(ICON), alignItems: 'center', justifyContent: 'center' },
  spacer: { flex: 1 },
}));
