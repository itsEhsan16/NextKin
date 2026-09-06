import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';

import type { JdFile, Resume } from '@/data/models';
// Deep import on purpose: the resumes barrel drags its screens in, and this file is reachable
// from the create barrel that @/navigation imports. docMeta is pure formatting.
import { docSubtitle } from '@/features/resumes/docMeta';
import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { OptionSheet, type SheetOption } from '@/ui/OptionSheet';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { RUBRIC_CTA } from '../atsCheckSetup';

/**
 * The picker draws the choice but does not own the library sheet: a `Sheet` rendered inside the
 * page's scroller would scrim the scrolling content instead of the window, so `onChooseResume`
 * raises a sheet the screen mounts beside its `<Screen>`.
 */
export type AtsCheckSourcePickerProps = {
  /** The library document a check would score. Absent when the source is a file. */
  resume?: Resume;
  /** The file picked off the device, before it has been read into a document. */
  file?: JdFile;
  /** Opens the library sheet — see the note above. */
  onChooseResume: () => void;
  /** Opens the system file browser. */
  onChooseFile: () => void;
  /** Drops the picked file and goes back to the library. */
  onUseLibrary: () => void;
  /**
   * V2 §7.8's published rubric, which is addressed by document — so the caller passes this only
   * once a document is chosen, and the link is absent until then.
   */
  onOpenRubric?: () => void;
  /** The file browser is open. */
  picking: boolean;
};

/** Grouped-row metrics, matching ListRow so this row lines up with every other carded row. */
const ROW_PADDING = 20;
const ROW_GUTTER = 16;
const CHEVRON = 11;

/**
 * Which document the ATS check runs against (V2 §7.8 / §4.1): a resume already in the library, or
 * a file off the device. One choice rather than two screens — the library is preselected because
 * most readers have one, and the ghost control underneath swaps the whole source over.
 *
 * Nothing here is said about the profile. §7.4 makes a parse yield a DRAFT that only its own
 * review screen may accept, so an ATS check on an uploaded file must not imply the profile moved.
 */
export function AtsCheckSourcePicker({
  resume,
  file,
  onChooseResume,
  onChooseFile,
  onUseLibrary,
  onOpenRubric,
  picking,
}: AtsCheckSourcePickerProps) {
  const { colors, sizes, spacing, s } = useTheme();
  const styles = useStyles();

  return (
    <View style={{ gap: spacing[3] }}>
      <Text variant="groupLabel">Resume to check</Text>

      {file ? (
        <Card radius="card">
          <Text variant="title" numberOfLines={2}>
            {file.name}
          </Text>
          <Text variant="caption" color="textSecondary" style={{ marginTop: spacing[1] }}>
            From your device
          </Text>
        </Card>
      ) : resume ? (
        <Card radius="card" padding={0}>
          <Pressable
            {...a11yButton(`Resume to check, ${resume.title}`, 'Choose a different resume')}
            feedback="subtle"
            haptic="light"
            onPress={onChooseResume}
            style={[
              styles.row,
              {
                minHeight: sizes.listRow,
                paddingHorizontal: s(ROW_PADDING),
                paddingVertical: spacing[3],
                gap: s(ROW_GUTTER),
              },
            ]}
          >
            <View style={styles.rowText}>
              <Text variant="rowTitle" numberOfLines={1}>
                {resume.title}
              </Text>
              <Text variant="rowDescription" color="textSecondary" numberOfLines={1}>
                {docSubtitle(resume)}
              </Text>
            </View>
            <FontAwesome5 name="chevron-right" size={s(CHEVRON)} color={colors.iconChevron} solid />
          </Pressable>
        </Card>
      ) : null}

      <View style={{ gap: spacing[2] }}>
        <Button
          label={file ? 'Choose a different file' : 'Check a file from your device'}
          variant="ghost"
          icon="file-upload"
          loading={picking}
          onPress={onChooseFile}
          style={flat.startAligned}
        />
        {file ? (
          <Button
            label="Use a resume from your library"
            variant="ghost"
            onPress={onUseLibrary}
            style={flat.startAligned}
          />
        ) : null}
        {onOpenRubric ? (
          <Button
            label={RUBRIC_CTA}
            variant="ghost"
            onPress={onOpenRubric}
            style={flat.startAligned}
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * The library half of the choice, as a sheet. It is a SIBLING of the page's `<Screen>`, never a
 * child of its scroller: a Sheet's root is an absolute fill, so inside the scroll content box it
 * would scrim the content instead of the window.
 */
export type AtsCheckLibrarySheetProps = {
  open: boolean;
  documents: readonly Resume[];
  selectedId?: string;
  onSelect: (resumeId: string) => void;
  onClose: () => void;
};

export function AtsCheckLibrarySheet({
  open,
  documents,
  selectedId,
  onSelect,
  onClose,
}: AtsCheckLibrarySheetProps) {
  return (
    <OptionSheet
      open={open}
      title="Choose a resume"
      options={documents.map<SheetOption>((document) => ({
        key: document.id,
        label: document.title,
        caption: docSubtitle(document),
      }))}
      selectedKey={selectedId}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowText: { flex: 1, gap: s(2) },
}));

const flat = StyleSheet.create({
  startAligned: { alignSelf: 'flex-start' },
});
