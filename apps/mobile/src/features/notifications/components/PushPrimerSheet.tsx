import { View } from 'react-native';

import { registerPushDevice } from '@/data/pushDevice';
import {
  a11yButton,
  a11yHeader,
  getPushPermission,
  hitSlop8,
  requestPushPermission,
  storage,
} from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Pressable } from '@/ui/Pressable';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

import { useNotificationsStore } from '../notificationsStore';
import { Icon } from '@/ui/Icon';

const BELL_TILE = 64;

export const PRIMER_LEDE =
  'Only when a resume is ready, a saved job is closing, or an application needs you.';
export const primerTitleForApplication = (company: string): string =>
  `Get a reminder to check on ${company}`;
export const PRIMER_TITLE_FOR_RUN = 'Get told when it’s ready';

const RUN_ASKED_KEY = 'push.primerAskedForRun';

/** After "Yes, I applied": only to someone who hasn't answered the system's question yet. */
export async function offerPush(title: string): Promise<void> {
  if ((await getPushPermission()) === 'undetermined') {
    useNotificationsStore.getState().openPrimer(title);
  }
}

/** A first run is the first time anyone waits on us. Asked once; the applied moment can ask again. */
export async function offerPushForRun(): Promise<void> {
  if (storage.get<boolean>(RUN_ASKED_KEY)) return;
  storage.set(RUN_ASKED_KEY, true);
  await offerPush(PRIMER_TITLE_FOR_RUN);
}

/**
 * NOTIF 07 (Figma 1:2928) — the contextual push ask. The OS dialog fires ONLY from "Turn on
 * notifications" (note 1:2939 — never at launch, never on the sheet appearing); "Not now" just
 * closes, and the primer may return after a later application because an iOS denial is permanent.
 *
 * The board's copy promised word "when your application is viewed", an employer event no one can
 * tell us (toreview §144.1), so the headline and the line say what actually arrives.
 */
export function PushPrimerHost() {
  const { colors, radii, sizes, spacing, s } = useTheme();
  const styles = useStyles();

  const open = useNotificationsStore((state) => state.primerOpen);
  const title = useNotificationsStore((state) => state.primerTitle);
  const closePrimer = useNotificationsStore((state) => state.closePrimer);

  if (!title) return null;

  return (
    <Sheet
      open={open}
      onClose={closePrimer}
      height={sizes.sheetNotifHeight}
      accessibilityLabel="Notification primer"
    >
      <View style={{ paddingHorizontal: spacing.gutter, paddingBottom: spacing[4] }}>
        <View style={[styles.center, { marginTop: spacing[7] }]}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: s(BELL_TILE),
              height: s(BELL_TILE),
              borderRadius: radii.card,
              backgroundColor: colors.brandSurface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="Bell01" size="lg" color={colors.brand} />
          </View>
          <Text
            {...a11yHeader()}
            variant="headline"
            align="center"
            style={{ marginTop: spacing[5] }}
          >
            {title}
          </Text>
          <Text
            variant="body"
            color="textSecondary"
            align="center"
            style={[styles.lede, { marginTop: spacing[3] }]}
          >
            {PRIMER_LEDE}
          </Text>
        </View>

        <Button
          label="Turn on notifications"
          size="lg"
          block
          onPress={() => {
            // The OS dialog owns the interaction from here; a yes registers the phone.
            void requestPushPermission().then((answer) => {
              if (answer === 'granted') void registerPushDevice().catch(() => undefined);
            });
            closePrimer();
          }}
          style={{ marginTop: spacing[6] }}
        />
        <Pressable
          {...a11yButton('Not now')}
          feedback="subtle"
          hitSlop={hitSlop8}
          onPress={closePrimer}
          style={[styles.notNow, { marginTop: spacing[5] }]}
        >
          <Text variant="bodySemiBold" color="textSecondary" align="center">
            Not now
          </Text>
        </Pressable>
        <Text
          variant="captionSm"
          color="textTertiary"
          align="center"
          style={{ marginTop: spacing[5] }}
        >
          You can change this any time in Profile › Notifications
        </Text>
      </View>
    </Sheet>
  );
}

const useStyles = scaledSheet((s) => ({
  center: { alignItems: 'center' },
  lede: { maxWidth: s(340) },
  notNow: { alignSelf: 'center' },
}));
