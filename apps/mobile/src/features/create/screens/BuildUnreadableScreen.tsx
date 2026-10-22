import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isUnreadableLinkError, useExtractJd } from '@/data/queries';
// Deep import on purpose, as BuildRunView does: the ✕-only chrome of the Build flow (BUILD 05).
import { TailorChrome } from '@/features/generations/components/TailorChrome';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

import { BuildTipCard } from '../components/BuildNotes';
import { FLOW_ART, FlowHero } from '../components/FlowHero';

export type BuildUnreadableScreenProps = { url: string };

const TITLE = 'We couldn’t read that job page';
const LEDE = 'Paste the job description instead — it only takes a few seconds.';
const WHY = 'Some career sites block automatic reading or show a blank page.';
const STILL_BLOCKED = 'That page still blocks reading. Paste the description instead.';
const RETRY_FAILED = "We couldn't reach that page. Check your connection and try again.";

// BUILD 05b at 390 (653:186), in artboard units.
const BAR_TO_ART = 43 / 0.75; // 661:36
const HERO_TO_TIP = 20 / 0.75; // 653:200
const BUTTON_GAP = 10 / 0.75; // 653:216

/**
 * BUILD 05b (653:186) — "We couldn't read that job page": the site behind the link refused to be
 * read. Paste the description instead (back to BUILD 03's Description tab, cleared and focused),
 * or try the link again; both sit stacked at the foot. ✕ leaves the Build flow.
 */
export function BuildUnreadableScreen({ url }: BuildUnreadableScreenProps) {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const extract = useExtractJd();
  const [failure, setFailure] = useState<string>();
  const busy = useRef(false);

  const retry = async () => {
    if (!url || busy.current) return;
    busy.current = true;
    setFailure(undefined);
    try {
      const draft = await extract.mutateAsync({ source: 'link', url });
      router.replace({ pathname: '/create/build/review', params: { jdId: draft.id } });
    } catch (error) {
      const message = isUnreadableLinkError(error) ? STILL_BLOCKED : RETRY_FAILED;
      setFailure(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      busy.current = false;
    }
  };

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<TailorChrome onClose={() => router.dismissTo('/create/build')} />}
      headerStyle={{ paddingBottom: s(BAR_TO_ART) }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
      footer={
        <View
          style={[
            styles.buttons,
            {
              paddingHorizontal: spacing.gutter,
              paddingTop: spacing[4],
              paddingBottom: spacing[4] + insets.bottom,
            },
          ]}
        >
          <Button
            label="Paste the description"
            icon="file-alt"
            size="lg"
            block
            onPress={() =>
              router.dismissTo({
                pathname: '/create/build/add',
                params: { mode: 'paste', at: String(Date.now()) },
              })
            }
          />
          {url ? (
            <Button
              label="Try the link again"
              icon="sync"
              variant="ghost"
              size="lg"
              block
              loading={extract.isPending}
              onPress={() => void retry()}
            />
          ) : null}
          {failure ? (
            <Text variant="caption" color="danger" align="center" accessibilityLiveRegion="polite">
              {failure}
            </Text>
          ) : null}
        </View>
      }
    >
      <Animated.View>
        <FlowHero title={TITLE} lede={LEDE} art={FLOW_ART.buildUnreadable} />
      </Animated.View>
      <Animated.View style={styles.tip}>
        <BuildTipCard title="Why this happens" text={WHY} />
      </Animated.View>
    </Screen>
  );
}

const useStyles = scaledSheet((s) => ({
  tip: { marginTop: s(HERO_TO_TIP) },
  buttons: { gap: s(BUTTON_GAP) },
}));
