import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppVersionPolicy, useUpgradeRequired } from '@/data/queries';
import { useTheme } from '@/theme';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { StateView } from '@/ui/StateView';

import {
  canOpenStore,
  dismissedVersion,
  dismissVersion,
  openStore,
  updateState,
} from './appUpdate';

export const REQUIRED_TITLE = 'Update NextKin';
export const REQUIRED_MESSAGE = canOpenStore
  ? 'This version is no longer supported. Update from the Play Store to keep going.'
  : 'This version is no longer supported. Update from the App Store to keep going.';
export const STORE_FAILED = 'We couldn’t open the store. Open Google Play and search for NextKin.';
export const AVAILABLE_TITLE = 'A new version is ready';
export const AVAILABLE_MESSAGE = 'Update NextKin for the latest fixes and improvements.';

/**
 * The update prompts, above every screen, signed in or out (toreview §245). Mounted once in the
 * root layout. With nothing to say it renders nothing and costs one small read per hour.
 */
export function AppUpdateHost() {
  const policy = useAppVersionPolicy();
  const forced = useUpgradeRequired((state) => state.required);
  // Read once: "Not now" writes it and hides the sheet in the same move.
  const [dismissed, setDismissed] = useState(dismissedVersion);

  const state = updateState({ policy: policy.data, forced, dismissed });
  const latest = policy.data?.latest ?? null;

  if (state === 'required') return <UpdateRequired />;
  return (
    <ConfirmSheet
      open={state === 'available'}
      title={AVAILABLE_TITLE}
      message={AVAILABLE_MESSAGE}
      confirmLabel="Update"
      cancelLabel="Not now"
      onConfirm={() => {
        void openStore();
        // Asked once per release either way: the store, not this sheet, takes it from here.
        if (latest) dismissVersion(latest);
        setDismissed(latest);
      }}
      onCancel={() => {
        if (latest) dismissVersion(latest);
        setDismissed(latest);
      }}
    />
  );
}

/**
 * Below the server's floor nothing else would work, so this covers the whole app. Android's back
 * stays here rather than walking the stack underneath; leaving the app is the home button.
 */
function UpdateRequired() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  return (
    <View
      accessibilityViewIsModal
      style={[
        StyleSheet.absoluteFill,
        styles.fill,
        {
          backgroundColor: colors.surfacePage,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingHorizontal: spacing.gutter,
        },
      ]}
    >
      <StateView
        icon="RefreshCw01"
        title={REQUIRED_TITLE}
        message={failed ? STORE_FAILED : REQUIRED_MESSAGE}
        {...(canOpenStore
          ? {
              actionLabel: 'Update',
              onAction: () =>
                void openStore().then((result) => setFailed(result === 'unavailable')),
            }
          : {})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Above sheets and toasts: nothing under it can be used.
  fill: { zIndex: 100, justifyContent: 'center' },
});
