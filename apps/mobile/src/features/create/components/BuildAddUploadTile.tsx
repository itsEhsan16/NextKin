import { View } from 'react-native';

import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Spinner } from '@/ui/motion';
import { Icon } from '@/ui/Icon';

export type BuildAddUploadTileProps = {
  /** The picked file's name; the tile then says it is ready instead of offering the upload. */
  fileName?: string;
  picking?: boolean;
  onPress: () => void;
};

export const UPLOAD_HINT = 'PDF, DOCX or TXT';

// "Upload a job file instead" at 390 (653:40), in artboard units.
const PAD_X = 15 / 0.75;
const PAD_Y = 18 / 0.75;
const GAP = 13 / 0.75;
const BORDER = 1.25 / 0.75;
const TILE = 44 / 0.75; // 653:42
const TILE_RADIUS = 12 / 0.75;
const TEXT_GAP = 2 / 0.75;

/**
 * BUILD 03's "Upload a job file instead" (653:40): the dashed lavender tile under the OR, with the
 * file glyph on its brand tile and the accepted formats. Once a file is picked it names it.
 */
export function BuildAddUploadTile({
  fileName,
  picking = false,
  onPress,
}: BuildAddUploadTileProps) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();
  const title = fileName ?? 'Upload a job file instead';
  const caption = fileName ? 'Ready to read · tap to choose another' : UPLOAD_HINT;

  return (
    <Pressable
      {...a11yButton(
        fileName ? `Job file, ${fileName}` : 'Upload a job file instead',
        fileName ? 'Choose a different file' : UPLOAD_HINT,
      )}
      accessibilityState={{ busy: picking }}
      feedback="scale"
      haptic="light"
      disabled={picking}
      onPress={onPress}
      style={[
        styles.tile,
        {
          borderRadius: radii.cardLg,
          backgroundColor: colors.surfaceNewDoc,
          borderColor: fileName ? colors.brandBorder : colors.borderBrandDashed,
        },
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: colors.tileBrandStrong }]}>
        <Icon name="File06" size="md" color={colors.brand} />
      </View>
      <View style={styles.text}>
        <Text variant="label" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {caption}
        </Text>
      </View>
      {picking ? (
        <Spinner size={s(15 / 0.75)} />
      ) : fileName ? (
        <Icon name="Check" size="lg" color={colors.glyphSuccess} />
      ) : null}
    </Pressable>
  );
}

const useStyles = scaledSheet((s) => ({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: s(BORDER),
    borderStyle: 'dashed',
    paddingHorizontal: s(PAD_X),
    paddingVertical: s(PAD_Y),
    gap: s(GAP),
  },
  iconTile: {
    width: s(TILE),
    height: s(TILE),
    borderRadius: s(TILE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: s(TEXT_GAP) },
}));
