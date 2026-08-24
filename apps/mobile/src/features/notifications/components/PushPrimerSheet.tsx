import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import { a11yButton, a11yHeader, hitSlop8, requestPushPermission } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Pressable } from '@/ui/Pressable';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

import { useNotificationsStore } from '../notificationsStore';

const BELL_TILE = 64;
const BELL = 26;

/**
 * NOTIF 07 (Figma 1:2928) — the contextual push ask, raised over Job Detail right after an
 * application is sent. The OS dialog fires ONLY from "Turn on notifications" (note 1:2939 —
 * never at launch, never on the sheet appearing); "Not now" just closes, and the primer may
 * return after a later application because an iOS denial is permanent.
 */
export function PushPrimerHost() {
  const { colors, radii, sizes, spacing, s } = useTheme();
  const styles = useStyles();

  const open = useNotificationsStore((state) => state.primerOpen);
  const company = useNotificationsStore((state) => state.primerCompany);
  const closePrimer = useNotificationsStore((state) => state.closePrimer);

  if (!company) return null;

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
            <FontAwesome5 name="bell" size={s(BELL)} color={colors.brand} solid />
          </View>
          <Text {...a11yHeader()} variant="headline" align="center" style={{ marginTop: spacing[5] }}>
            {`Get notified when ${company} responds`}
          </Text>
          <Text variant="body" color="textSecondary" align="center" style={[styles.lede, { marginTop: spacing[3] }]}>
            {"We'll tell you when your application is viewed, changes stage, or gets a decision. Nothing else."}
          </Text>
        </View>

        <Button
          label="Turn on notifications"
          size="lg"
          block
          haptic="medium"
          onPress={() => {
            // Fire-and-forget: the OS dialog owns the interaction from here.
            void requestPushPermission();
            closePrimer();
          }}
          style={{ marginTop: spacing[6] }}
        />
        <Pressable
          {...a11yButton('Not now')}
          feedback="subtle"
          haptic="selection"
          hitSlop={hitSlop8}
          onPress={closePrimer}
          style={[styles.notNow, { marginTop: spacing[5] }]}
        >
          <Text variant="bodySemiBold" color="textSecondary" align="center">
            Not now
          </Text>
        </Pressable>
        <Text variant="captionSm" color="textTertiary" align="center" style={{ marginTop: spacing[5] }}>
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
