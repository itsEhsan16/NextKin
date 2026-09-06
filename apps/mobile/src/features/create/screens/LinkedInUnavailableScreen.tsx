import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';

import { useCreateActions } from '../hooks/useCreateActions';

/**
 * Stated once, in full, because the whole screen is this sentence: the limit is LinkedIn's and
 * the workaround is real.
 */
const WHY =
  'LinkedIn has no public API that lets another app pull your profile, so there is no honest ' +
  'way for us to offer it. Export your profile from LinkedIn as a PDF and upload that file — ' +
  'it gets you the same result today.';

/**
 * CREATE 02's "Import from LinkedIn" row (V2 §6.2 — out of scope, no supported API).
 *
 * The row is designed, so it stays; this screen is where the app is honest about what is behind
 * it. It is not a waiting room: the upload path does the same job, and it is the primary action
 * here rather than a footnote under an apology.
 *
 * No data, no quota, no four states — nothing is fetched, so there is nothing to load, empty or
 * fail.
 */
export function LinkedInUnavailableScreen() {
  const { spacing } = useTheme();
  const { goBack, openUpload } = useCreateActions();

  return (
    <Screen
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Import from LinkedIn" onBack={goBack} />}
      headerStyle={{ paddingBottom: spacing[4] }}
    >
      <View style={styles.body}>
        <StateView
          icon="link"
          title="LinkedIn import isn't available yet"
          message={WHY}
          actionLabel="Upload a PDF instead"
          onAction={openUpload}
          secondaryLabel="Not now"
          onSecondary={goBack}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center' },
});
