import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { JdFile, JdInput } from '@/data/models';
import { isUnreadableLinkError, useExtractJd } from '@/data/queries';
import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';
import { pickDocument } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { SegmentedControl, type Segment } from '@/ui/SegmentedControl';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Spinner } from '@/ui/motion';

import { BuildAddPasteBox } from '../components/BuildAddPasteBox';
import { BuildAddUploadTile } from '../components/BuildAddUploadTile';
import { BuildTipCard, OrDivider } from '../components/BuildNotes';
import { FLOW_ART, FlowHero } from '../components/FlowHero';

export type BuildAddJobScreenProps = {
  /** 'paste' when BUILD 05b sends the user back: the box opens cleared and focused. */
  mode?: string;
  /** Changes on every such return, so a second trip back clears the box again. */
  at?: string;
};

type AddMode = 'link' | 'description' | 'file';

const TITLE = 'Add the job';
const LEDE = 'Paste a link, the job description, or upload a file.';
const SEGMENTS: readonly Segment<AddMode>[] = [
  { key: 'link', label: 'Paste link' },
  { key: 'description', label: 'Description' },
  { key: 'file', label: 'Upload file' },
];
const CTA = 'Build my resume';
const READING = 'Reading the job…';
const HINT = 'Paste a job or upload a file to continue';
const READ_FAILED = "We couldn't read that job. Check your connection and try again.";
const TOO_BIG = 'That file is over 5 MB. Choose a smaller one or paste the text.';
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// BUILD 03 at 390 (653:2), in artboard units.
const HEADER_TO_ART = 7 / 0.75; // 661:30 rides up over 653:6
const HERO_TO_TABS = 18 / 0.75; // 653:16
const TABS_TO_BOX = 12 / 0.75; // 653:22
const BOX_TO_TIP = 10 / 0.75; // 653:27
const TIP_TO_OR = 14 / 0.75; // 653:34 / 653:39
const SPARKLE_W = 18 / 0.75; // 653:46
const SPARKLE_H = 17.6315 / 0.75;

/** One token that looks like a web address — "cred.club/careers/…" or a full https link. */
const URL_LIKE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?([/?#]\S*)?$/i;

/** What the press reads: a file beats text, and a lone URL-looking token is a link. */
export function buildAddInput(text: string, file: JdFile | null): JdInput | null {
  if (file) return { source: 'file', file };
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/\s/.test(trimmed) && URL_LIKE.test(trimmed)) return { source: 'link', url: trimmed };
  return { source: 'paste', text: trimmed };
}

/**
 * BUILD 03 (653:2) — "Add the job": a job from anywhere for Home's Build Resume (toreview §74).
 * Paste link (drawn), Description (the same box, taller) or Upload file; a file can go in from
 * either paste tab too, under the OR. The button READS the job and opens BUILD 04 to review it;
 * nothing is built (or counted) from here. A site that blocks reading opens BUILD 05b.
 */
export function BuildAddJobScreen({ mode, at }: BuildAddJobScreenProps) {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const extract = useExtractJd();

  const [tab, setTab] = useState<AddMode>(mode === 'paste' ? 'description' : 'link');
  const [text, setText] = useState('');
  const [file, setFile] = useState<JdFile | null>(null);
  const [picking, setPicking] = useState(false);
  const [failure, setFailure] = useState<string>();
  const busy = useRef(false);

  // Back from 05b's "Paste the description": start over on an empty box. Adjusted during render,
  // not in an effect, so the stale text never paints.
  const [seenAt, setSeenAt] = useState(at);
  if (at !== seenAt) {
    setSeenAt(at);
    setTab(mode === 'paste' ? 'description' : 'link');
    setText('');
    setFile(null);
    setFailure(undefined);
  }

  const input = buildAddInput(text, file);
  const reading = extract.isPending;

  const fail = (message: string) => {
    setFailure(message);
    AccessibilityInfo.announceForAccessibility(message);
  };

  const upload = async () => {
    setPicking(true);
    try {
      const picked = await pickDocument(['pdf', 'docx', 'txt']);
      // A cancel (or no picker in this runtime) is not an error: nothing changes.
      if (!picked) return;
      if (picked.size != null && picked.size > MAX_FILE_BYTES) return fail(TOO_BIG);
      setFailure(undefined);
      setFile(picked);
      setText('');
    } finally {
      setPicking(false);
    }
  };

  const submit = async () => {
    if (!input || busy.current) return;
    busy.current = true;
    setFailure(undefined);
    try {
      const draft = await extract.mutateAsync(input);
      router.push({
        pathname: '/create/build/review',
        params: { jdId: draft.id, ...(file ? { fileName: file.name } : {}) },
      });
    } catch (error) {
      if (input.source === 'link' && isUnreadableLinkError(error)) {
        router.push({ pathname: '/create/build/unreadable', params: { url: input.url } });
      } else {
        fail(READ_FAILED);
      }
    } finally {
      busy.current = false;
    }
  };

  const uploadTile = (
    <BuildAddUploadTile fileName={file?.name} picking={picking} onPress={() => void upload()} />
  );

  return (
    <Screen
      keyboard
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title={TITLE} showTitle={false} onBack={() => router.back()} />}
      headerStyle={{ paddingBottom: s(HEADER_TO_ART) }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
      footer={
        // The failure leaves the button live, so pressing it again is the retry.
        <StickyActionBar
          floating
          note={failure ?? (input ? undefined : HINT)}
          noteTone={failure ? 'danger' : 'neutral'}
          primary={{
            label: reading ? READING : CTA,
            // While the job is read, the sparkle gives way to the turning ring: the label says
            // what is happening, the ring says it is still happening (§85).
            leading: reading ? (
              <Spinner size={s(SPARKLE_H)} color="textOnDark" />
            ) : (
              <SparkleIcon width={s(SPARKLE_W)} height={s(SPARKLE_H)} />
            ),
            disabled: input == null,
            onPress: () => void submit(),
          }}
        />
      }
    >
      <Animated.View>
        <FlowHero title={TITLE} lede={LEDE} art={FLOW_ART.buildAdd} />
      </Animated.View>

      <Animated.View style={styles.tabs}>
        <SegmentedControl segments={SEGMENTS} value={tab} onChange={setTab} />
      </Animated.View>

      <Animated.View style={styles.parts}>
        {tab === 'file' ? (
          <>
            {uploadTile}
            <BuildTipCard
              title="What we can read"
              text="A PDF, DOCX or TXT of the job posting, up to 5 MB."
            />
          </>
        ) : (
          <>
            <BuildAddPasteBox
              // Remounted on a return from 05b, so autoFocus fires again.
              key={at ?? 'first'}
              mode={tab}
              value={text}
              onChangeText={(next) => {
                setText(next);
                setFailure(undefined);
                // Typing replaces a picked file: one source at a time.
                if (next.trim()) setFile(null);
              }}
              autoFocus={mode === 'paste'}
            />
            {tab === 'link' ? (
              <BuildTipCard
                title="Supported links"
                text="Careers pages, LinkedIn, Naukri, or any job posting link."
              />
            ) : null}
            <View style={styles.or}>
              <OrDivider />
              {uploadTile}
            </View>
          </>
        )}
      </Animated.View>
    </Screen>
  );
}

const useStyles = scaledSheet((s) => ({
  tabs: { marginTop: s(HERO_TO_TABS) },
  parts: { marginTop: s(TABS_TO_BOX), gap: s(BOX_TO_TIP) },
  or: { marginTop: s(TIP_TO_OR - BOX_TO_TIP), gap: s(TIP_TO_OR) },
}));
