import { Image } from 'expo-image';
import { View } from 'react-native';

import { a11yButton, a11yHeader, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';

/**
 * One file row on the saved sheet. `meta` is the grey line under the name. A row whose file has
 * not been saved yet (COVER 04's resume, when this session never exported it) carries `onSave`
 * in place of the green tick.
 */
export type TailorSavedFile = {
  name: string;
  meta: string;
  onSave?: () => void;
  /** The row's own export is running. */
  saving?: boolean;
  /** Another export holds the share sheet, so this one waits. */
  saveDisabled?: boolean;
};

export type TailorSavedSheetBodyProps = {
  files: readonly TailorSavedFile[];
  company?: string;
  /** "stripe.com"; without one there is nowhere to send the user, so the button is left out. */
  domain?: string;
  /** Override Tailor's "Saved. Now apply on …" title and its lede (COVER 04 613:1738). */
  title?: string;
  lede?: string;
  /** What read back from the file (toreview §146.6). */
  receipt?: string;
  onApply: () => void;
  onDone: () => void;
};

// TAILOR 06 at 390 (608:483), in artboard units. A floor: a second file row (COVER 04 613:1742)
// grows the sheet past it.
/** IL-T1, the board's 150 × 112 slot above the title, holding the clay "applied" art (§211). */
const ART_W = 150 / 0.75;
const ART_H = 97.2 / 0.75;
const ART_TO_TITLE = 12 / 0.75;
const SHEET_H = (455.5 - 126) / 0.75 + ART_H + ART_TO_TITLE;
const TOP = 16 / 0.75; // the board's 30 less the handle, as ConfirmSheet measures it
const BOTTOM = 30 / 0.75;
const TITLE_TO_LEDE = 8 / 0.75;
const LEDE_TO_FILE = 18 / 0.75;
const FILE_PAD_L = 12 / 0.75;
const FILE_PAD_R = 14 / 0.75;
const FILE_PAD_Y = 11 / 0.75;
const FILE_GAP = 12 / 0.75;
const TILE = 36 / 0.75;
const TILE_RADIUS = 9 / 0.75;
/** COVER 04's divider starts under the text, past the tile (613:1751 x 60). */
const DIVIDER_INSET = (12 + 36 + 12) / 0.75;
const SAVE_H = 16 / 0.75;
const FILE_TO_ACTIONS = 20 / 0.75;
const BUTTON_GAP = 10 / 0.75;

/** Tailor's one-file meta line: "2 pages · Saved as PDF". */
export const savedPagesLabel = (pages?: number) =>
  pages != null ? `${pages} page${pages === 1 ? '' : 's'} · Saved as PDF` : 'Saved as PDF';

function FileRow({ file }: { file: TailorSavedFile }) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  const { onSave } = file;

  return (
    <View style={styles.fileRow}>
      <View
        accessible
        accessibilityLabel={`${file.name}, ${file.meta}`}
        style={[styles.fileRow, styles.fileMain]}
      >
        <View style={[styles.tile, { backgroundColor: colors.dangerSurface }]}>
          <Icon name="File04" size="md" color={colors.glyphDanger} />
        </View>
        <View style={styles.fileText}>
          <Text variant="titleSm" numberOfLines={1}>
            {file.name}
          </Text>
          <Text variant="micro" color="textSecondary">
            {file.meta}
          </Text>
        </View>
      </View>
      {onSave ? (
        <Pressable
          {...a11yButton(`Save ${file.name}`, 'Saves this file as a PDF')}
          accessibilityState={{ disabled: !!file.saveDisabled, busy: !!file.saving }}
          disabled={file.saveDisabled || file.saving}
          feedback="subtle"
          hitSlop={hitSlopFor(s(SAVE_H))}
          onPress={onSave}
        >
          <Text variant="viewAllLink" color={file.saveDisabled ? 'textTertiary' : 'brand'}>
            {file.saving ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      ) : (
        <Icon name="CheckCircle" size="md" color={colors.success} />
      )}
    </View>
  );
}

/** TAILOR 06's content alone, testable without the Sheet's gestures and animation. */
export function TailorSavedSheetBody({
  files,
  company,
  domain,
  title,
  lede,
  receipt,
  onApply,
  onDone,
}: TailorSavedSheetBodyProps) {
  const { colors, motion, spacing, s } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.body, { paddingHorizontal: spacing.gutter }]}>
      <Image
        source={require('../../../../assets/illustrations/tailor/applied.webp')}
        contentFit="contain"
        transition={motion.durations.imageFade}
        cachePolicy="memory-disk"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: s(ART_W),
          height: s(ART_H),
          alignSelf: 'center',
          marginBottom: s(ART_TO_TITLE),
        }}
      />
      <Text {...a11yHeader()} variant="confirmTitle" align="center">
        {title ??
          (company ? `Saved. Now apply on ${company}’s site` : 'Saved. Now apply on their site')}
      </Text>
      <Text variant="captionRegular" color="textSecondary" align="center" style={styles.lede}>
        {lede ??
          `${company ?? 'The employer'} takes applications on its own careers page. Upload this resume there.`}
      </Text>

      {/* The board's 15 corner is radii.card (20 in 520 space). One stop per file for a reader. */}
      <Card radius="card" padding={0} style={styles.file}>
        {files.map((file, index) => (
          <View key={file.name}>
            {index > 0 ? (
              <View
                style={[
                  styles.divider,
                  { backgroundColor: colors.borderHairline, marginLeft: s(DIVIDER_INSET) },
                ]}
              />
            ) : null}
            <View style={styles.filePad}>
              <FileRow file={file} />
            </View>
          </View>
        ))}
      </Card>
      {receipt ? (
        <Text variant="micro" color="textSecondary" align="center" style={styles.lede}>
          {receipt}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {domain ? (
          <Button
            label={`Apply on ${domain}`}
            icon="LinkExternal01"
            size="lg"
            onPress={onApply}
            block
          />
        ) : null}
        <Button label="Done" variant="ghost" size="lg" onPress={onDone} block />
      </View>
    </View>
  );
}

export type TailorSavedSheetProps = TailorSavedSheetBodyProps & { open: boolean };

/** TAILOR 06 (608:396): raised over the ready screen once the PDF has been handed off. */
export function TailorSavedSheet({ open, ...body }: TailorSavedSheetProps) {
  const { s } = useTheme();
  return (
    <Sheet
      open={open}
      onClose={body.onDone}
      height={s(SHEET_H)}
      accessibilityLabel={`Saved ${body.files.map((file) => file.name).join(' and ')}`}
    >
      <TailorSavedSheetBody {...body} />
    </Sheet>
  );
}

const useStyles = scaledSheet((s) => ({
  body: { paddingTop: s(TOP), paddingBottom: s(BOTTOM) },
  lede: { marginTop: s(TITLE_TO_LEDE) },
  file: { marginTop: s(LEDE_TO_FILE) },
  filePad: {
    paddingLeft: s(FILE_PAD_L),
    paddingRight: s(FILE_PAD_R),
    paddingVertical: s(FILE_PAD_Y),
  },
  divider: { height: s(1), marginRight: s(FILE_PAD_R) },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: s(FILE_GAP) },
  fileMain: { flex: 1 },
  tile: {
    width: s(TILE),
    height: s(TILE),
    borderRadius: s(TILE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileText: { flex: 1, gap: s(2) },
  actions: { marginTop: s(FILE_TO_ACTIONS), gap: s(BUTTON_GAP) },
}));
