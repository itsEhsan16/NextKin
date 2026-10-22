import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import { a11yButton, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Spinner } from '@/ui/motion';

import { PROFILE_ROW_ART } from '../profileRowArt';
import { ProfileCard, SectionCard } from './cards';
import { CompletenessRing, EDIT_RING } from './CompletenessRing';

// PROFILE 03's identity card at 390 (577:5349), in artboard units.
const PAD = 16 / 0.75;
const GAP = 16 / 0.75;
/** The ring and the badge hanging under it (577:5350 is 84 × 92). */
const RING_BOX_H = 92 / 0.75;
const NAME_TO_BUTTON = 9 / 0.75;
const BUTTON_TO_HELPER = 7 / 0.75;
const PHOTO_BUTTON_H = 32 / 0.75;
const PHOTO_BUTTON_PAD_X = 12 / 0.75;
const PHOTO_BUTTON_GAP = 5 / 0.75;
const CAMERA = 10 / 0.75;
/** The Account card's email row (577:5472). */
const ROW_PAD_X = 14 / 0.75;
const ROW_PAD_Y = 11 / 0.75;
const ROW_GAP = 12 / 0.75;
const ROW_GLYPH = 13 / 0.75;
const CHEVRON = 9 / 0.75;

const HELPER = 'Saves as soon as you pick it — no need to press Save.';

export type EditIdentityCardProps = {
  name: string;
  /** Remote URL, `asset:` key, or the local URI the picker just handed back. */
  photo?: string;
  completeness: number;
  /** The photo write is in flight: the button spins and refuses a second pick. */
  busy?: boolean;
  /** Replaces the helper line and paints it in the danger tone. */
  error?: string;
  onPick: () => void;
};

/**
 * The head of Edit profile (PROFILE 03 577:5349): the photo inside the completeness ring, the name,
 * and Change photo. The picture is the only field on the page that does not wait for Save, and the
 * helper line says so, because a control that behaves differently from the fields below it has to
 * admit that on screen rather than in a code comment.
 */
export function EditIdentityCard({
  name,
  photo,
  completeness,
  busy = false,
  error,
  onPick,
}: EditIdentityCardProps) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();

  return (
    <ProfileCard style={styles.card}>
      <View style={styles.ringBox}>
        <CompletenessRing completeness={completeness} geometry={EDIT_RING}>
          <Avatar name={name} source={photo} size={s(EDIT_RING.avatar)} />
        </CompletenessRing>
      </View>
      <View style={styles.details}>
        <Text variant="cardTitle" numberOfLines={1}>
          {name}
        </Text>
        <Pressable
          {...a11yButton('Change photo', HELPER)}
          accessibilityState={{ busy, disabled: busy }}
          disabled={busy}
          feedback="scale"
          haptic="light"
          hitSlop={hitSlopFor(s(PHOTO_BUTTON_H))}
          onPress={onPick}
          style={[
            styles.photoButton,
            { borderRadius: radii.full, backgroundColor: colors.surfaceSubtle },
          ]}
        >
          {busy ? (
            <Spinner size={s(15 / 0.75)} color="textPrimary" />
          ) : (
            <>
              <FontAwesome5 name="camera" size={s(CAMERA)} color={colors.textPrimary} solid />
              <Text variant="captionSemiBold">Change photo</Text>
            </>
          )}
        </Pressable>
        <Text
          variant="micro"
          color={error ? 'danger' : 'textSecondary'}
          accessibilityLiveRegion="polite"
          style={styles.helper}
        >
          {error ?? HELPER}
        </Text>
      </View>
    </ProfileCard>
  );
}

/** The Account card: the email, which opens email and password settings (577:5455). */
export function AccountCard({ email, onPress }: { email: string; onPress: () => void }) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();

  return (
    <SectionCard art={PROFILE_ROW_ART.emailPassword} artWidth={28} title="Account">
      <Pressable
        {...a11yButton(`Email, ${email}`, 'Opens email and password settings')}
        feedback="subtle"
        haptic="light"
        onPress={onPress}
        style={[styles.row, { borderRadius: radii.xl, backgroundColor: colors.surfaceSubtle }]}
      >
        <FontAwesome5 name="envelope" size={s(ROW_GLYPH)} color={colors.textSecondary} solid />
        <View style={styles.rowText}>
          <Text variant="menuRow">Email</Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {email}
          </Text>
        </View>
        <FontAwesome5 name="chevron-right" size={s(CHEVRON)} color={colors.iconChevron} solid />
      </Pressable>
    </SectionCard>
  );
}

const useStyles = scaledSheet((s) => ({
  card: { flexDirection: 'row', alignItems: 'center', padding: s(PAD), gap: s(GAP) },
  ringBox: { height: s(RING_BOX_H) },
  details: { flex: 1, alignItems: 'flex-start' },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: s(PHOTO_BUTTON_H),
    minWidth: s(PHOTO_BUTTON_H * 3),
    paddingHorizontal: s(PHOTO_BUTTON_PAD_X),
    gap: s(PHOTO_BUTTON_GAP),
    marginTop: s(NAME_TO_BUTTON),
  },
  helper: { marginTop: s(BUTTON_TO_HELPER) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(ROW_PAD_X),
    paddingVertical: s(ROW_PAD_Y),
    gap: s(ROW_GAP),
  },
  rowText: { flex: 1, gap: s(2 / 0.75) },
}));
