import { Image } from 'expo-image';
import { View } from 'react-native';

import type { FlowArt } from '@/features/create/components/FlowHero';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import type { ListRowArt } from '@/ui/ListRow';
import { Text } from '@/ui/Text';

import { Art, CARD_RADIUS } from './cards';

/** The list's own art, a title, why it is worth filling, and a quiet footnote. */
export type EntryListEmptyConfig = {
  art: ListRowArt;
  /** A board's drawn illustration (PROFILE 10's 680:107), in the icon's place. */
  image?: FlowArt;
  title: string;
  message: string;
  footnote?: string;
};

// The empty state (PROFILE 10 573:119) at 390: header → art, art → title → message → button → note.
const EMPTY_TOP = 52 / 0.75;
const EMPTY_ART = 150;
/** The illustration starts 25 into the hero (680:107 in 573:132); the icon sat at its top. */
const EMPTY_IMAGE_TOP = 25 / 0.75;
const EMPTY_TITLE_TOP = 22 / 0.75;
const EMPTY_MESSAGE_TOP = 8 / 0.75;
const EMPTY_BUTTON_TOP = 26 / 0.75;
const EMPTY_FOOTNOTE_TOP = 16 / 0.75;

/** A career-profile list with nothing in it yet (PROFILE 10), and the button that starts it. */
export function EntryListEmpty({
  empty,
  addLabel,
  onAdd,
}: {
  empty: EntryListEmptyConfig;
  addLabel: string;
  onAdd: () => void;
}) {
  const { motion, s } = useTheme();
  const styles = useStyles();

  return (
    <>
      <View style={styles.empty}>
        {empty.image ? (
          <Image
            source={empty.image.source}
            contentFit="contain"
            transition={motion.durations.imageFade}
            cachePolicy="memory-disk"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: s(empty.image.w / 0.75),
              height: s(empty.image.h / 0.75),
              marginTop: s(EMPTY_IMAGE_TOP),
              transform: [{ translateX: s(empty.image.shiftX / 0.75) }],
            }}
          />
        ) : (
          <View style={[styles.emptyArt, { borderRadius: s(CARD_RADIUS) }]}>
            <Art art={empty.art} width={EMPTY_ART} />
          </View>
        )}
        <Text variant="headlineLg" align="center" style={styles.emptyTitle}>
          {empty.title}
        </Text>
        <Text
          variant="captionRegular"
          color="textSecondary"
          align="center"
          style={styles.emptyMessage}
        >
          {empty.message}
        </Text>
      </View>
      <Button
        label={addLabel}
        icon="plus"
        size="lg"
        block
        onPress={onAdd}
        style={styles.emptyButton}
      />
      {empty.footnote ? (
        <Text variant="micro" color="textSecondary" align="center" style={styles.emptyFootnote}>
          {empty.footnote}
        </Text>
      ) : null}
    </>
  );
}

const useStyles = scaledSheet((s) => ({
  empty: { alignItems: 'center', paddingTop: s(EMPTY_TOP) },
  emptyArt: { alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: s(EMPTY_TITLE_TOP) },
  emptyMessage: { marginTop: s(EMPTY_MESSAGE_TOP) },
  emptyButton: { marginTop: s(EMPTY_BUTTON_TOP) },
  emptyFootnote: { marginTop: s(EMPTY_FOOTNOTE_TOP) },
}));
