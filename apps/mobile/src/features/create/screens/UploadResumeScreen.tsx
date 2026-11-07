import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useImportResume } from '@/data/queries';
import { pickDocument, useReducedMotion, type PickedDocument } from '@/lib';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Illustration } from '@/ui/kit';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';

import { UploadProgress } from '../components/UploadProgress';
import { useCreateActions } from '../hooks/useCreateActions';
import { useImportStore } from '../importStore';

/**
 * V2 §7.4's wording for a parse that found no text. An image-only scan is the common real cause,
 * so the sentence names the fix rather than the fault.
 */
const PARSE_FAILED = "We couldn't read that file — try a text-based PDF.";

const FORMATS = ['PDF', 'DOCX', 'TXT'] as const;

/**
 * CREATE — upload a resume (V2 §7.4). The first half of a two-screen flow: this page reads the
 * file, the review page decides what any of it is allowed to touch.
 *
 * Nothing here writes to the profile. A successful parse produces a real document AND a draft;
 * the document is already in the library, the draft goes into `useImportStore` and the review
 * screen REPLACES this one — back must not land on an upload that has already been spent.
 *
 * No artboard covers this flow (plan §8), so it is built from the spec on existing primitives.
 */
export type UploadResumeScreenProps = {
  /** A first resume: the review leads on to picking a job (toreview §145.2). */
  thenPickJob?: boolean;
};

export function UploadResumeScreen({ thenPickJob = false }: UploadResumeScreenProps) {
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();
  const actions = useCreateActions();
  const setImport = useImportStore((state) => state.setImport);

  const importResume = useImportResume();
  const [file, setFile] = useState<PickedDocument | null>(null);
  const [picking, setPicking] = useState(false);
  // The parse has landed and the card is showing it, for the beat before the review takes over.
  const [landed, setLanded] = useState(false);

  const choose = useCallback(async () => {
    setPicking(true);
    try {
      const picked = await pickDocument(['pdf', 'docx', 'txt']);
      // A cancel — or expo-document-picker being unavailable — is not a failure: the page returns
      // to rest and says nothing. `pickDocument` degrades to null rather than throwing.
      if (!picked) return;
      setFile(picked);
      importResume.mutate(picked, {
        onSuccess: ({ resume, draft }) => {
          setImport({ draft, resumeId: resume.id, thenPickJob });
          // Under Reduce Motion there is no check to watch land, so there is nothing to hold for.
          if (reduced) actions.openUploadReview();
          else setLanded(true);
        },
      });
    } finally {
      setPicking(false);
    }
  }, [actions, importResume, reduced, setImport, thenPickJob]);

  // A success is shown before it is acted on: the rows tick, the bar fills, the check draws in,
  // and the review replaces this page `successHold` later. Leaving first cancels the hand-off.
  useEffect(() => {
    if (!landed) return undefined;
    const timer = setTimeout(actions.openUploadReview, motion.durations.successHold);
    return () => clearTimeout(timer);
  }, [actions.openUploadReview, landed, motion.durations.successHold]);

  // `accessibilityLiveRegion` on the bar's note is Android-only, so the failure is announced
  // explicitly as well — once per falsy→truthy turn, the way TextField announces its error.
  const failed = importResume.isError;
  const announced = useRef(false);
  useEffect(() => {
    const was = announced.current;
    announced.current = failed;
    if (failed && !was) AccessibilityInfo.announceForAccessibility(PARSE_FAILED);
  }, [failed]);

  const parsing = importResume.isPending;

  const page = (children: ReactNode) => (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Upload a resume" onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: spacing[4] }}
      contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[6] }}
      footer={
        <StickyActionBar
          // The failure leaves the button live, so pressing it again is the retry.
          note={failed ? PARSE_FAILED : undefined}
          noteTone="danger"
          primary={{
            label: file && !parsing ? 'Choose another file' : 'Choose a file',
            icon: 'UploadCloud02',
            loading: picking || parsing || landed,
            onPress: () => void choose(),
          }}
        />
      }
    >
      {children}
    </Screen>
  );

  // Parsing is the loading state, and it is the only one this page has: nothing is fetched here,
  // so there is no skeleton to draw before the reader has picked anything.
  if ((parsing || landed) && file)
    return page(<UploadProgress fileName={file.name} done={landed} />);

  // The resting state is also the empty one — there is nothing to be empty of until a file is
  // picked, and the formats card is what belongs on the page either way.
  return page(
    <>
      {/* A hero over the formats card (§178): the page used to be one small card and white. */}
      <View style={[styles.hero, { gap: spacing[2], paddingTop: spacing[2] }]}>
        <Illustration name="noResumes" size={150} />
        <Text variant="title2" color="ink" align="center">
          Bring the resume you have
        </Text>
        <Text variant="callout" color="textSecondary" align="center">
          We read it, you check what we read, then it’s yours to tailor.
        </Text>
      </View>
      <Animated.View>
        <Card>
          <View style={{ gap: spacing[3] }}>
            <Text variant="title3" color="ink">
              What we can read
            </Text>
            <View style={[styles.formats, { gap: spacing[2] }]}>
              {FORMATS.map((format) => (
                <Chip key={format} label={format} />
              ))}
            </View>
            <Text variant="rowDescription" color="textSecondary">
              Text-based files only. Scans and photos can’t be read.
            </Text>
          </View>
        </Card>
      </Animated.View>

      {file && !parsing ? (
        <Animated.View>
          <Card radius="card">
            <Text variant="title" numberOfLines={2}>
              {file.name}
            </Text>
            <Text variant="caption" color="textSecondary" style={{ marginTop: spacing[1] }}>
              {failed ? "We couldn't read this one" : 'Ready to read'}
            </Text>
          </Card>
        </Animated.View>
      ) : null}
    </>,
  );
}

const styles = StyleSheet.create({
  formats: { flexDirection: 'row', flexWrap: 'wrap' },
  hero: { alignItems: 'center' },
});
