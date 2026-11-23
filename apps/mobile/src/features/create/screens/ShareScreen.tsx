import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { blockedSiteNotice, sharedJobOf, type JdInput } from '@/data/models';
import { startErrorLine } from '@/data/models/customize';
import {
  isConsentRequired,
  jdFailureMessage,
  jdFailureReason,
  track,
  unreadableLinkMessage,
  useExtractJd,
} from '@/data/queries';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { Spinner } from '@/ui/motion';

import { useShareStore } from '../shareStore';

export const SHARE_READING = 'Reading the job…';
export const SHARE_NOT_A_JOB = 'That doesn’t look like a job';
export const SHARE_FAILED = "Couldn't read that job";

/**
 * A job shared in from another app (owner, 2026-11-01, toreview §147.4). Sharing is the tap, so it
 * reads straight away and lands on the same review as any other job. A site that refuses is taken
 * at its word: the candidate goes to the paste box, told why. Spec-derived; no artboard draws it.
 */
export function ShareScreen() {
  const { colors, spacing, s } = useTheme();
  const router = useRouter();
  const text = useShareStore((state) => state.text);
  const extract = useExtractJd();
  // Why the shared job couldn't be read, said for what it was (toreview §262).
  const [failure, setFailure] = useState<string | null>(null);
  const shared = useMemo(() => sharedJobOf(text), [text]);

  // What a failed read says: consent's own line, the reading's sentence (busy, too long, not a
  // job…), or a site that refuses, which goes on to the paste box with its notice (§206, §262).
  const onFailed = useCallback(
    (input: JdInput, error: unknown) => {
      if (isConsentRequired(error)) {
        setFailure('Agree to how NextKin uses AI to read this job, then try again.');
        return;
      }
      const refused = input.source === 'link' ? unreadableLinkMessage(error) : null;
      const reason = jdFailureReason(error);
      const said = reason === 'listing' || reason === 'removed' || reason === 'gone';
      if (!refused || input.source !== 'link') {
        setFailure(
          jdFailureMessage(error) ?? startErrorLine(error, 'Check your connection and try again.'),
        );
        return;
      }
      router.replace({
        pathname: '/create/build/add',
        params: {
          mode: 'paste',
          at: String(Date.now()),
          // A list of jobs or a posting that is gone is not the site blocking us (§206).
          notice: (said ? null : blockedSiteNotice(input.url)) ?? refused,
        },
      });
    },
    [router],
  );

  const { mutate: extractJd } = extract;
  const read = useCallback(
    (input: JdInput) => {
      setFailure(null);
      // `mutate` with its own callbacks: after the consent dialog the read runs again, and these
      // still open the job (awaiting the first refusal lost that run).
      extractJd(input, {
        onSuccess: (draft) =>
          router.replace({ pathname: '/create/build/review', params: { jdId: draft.id } }),
        onError: (error) => onFailed(input, error),
      });
    },
    [extractJd, onFailed, router],
  );

  const started = useRef(false);
  useEffect(() => {
    if (started.current || !shared) return;
    started.current = true;
    track('job_shared');
    void read(shared);
  }, [read, shared]);

  const page = (children: React.ReactNode) => (
    <Screen
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Add the job" onBack={() => router.back()} />}
    >
      {children}
    </Screen>
  );

  if (!shared) {
    return page(
      <StateView
        icon="Briefcase01"
        title={SHARE_NOT_A_JOB}
        message="Share a job’s link or its full description, or add it yourself."
        actionLabel="Add a job"
        onAction={() => router.replace('/create/build/add')}
      />,
    );
  }

  if (failure) {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title={SHARE_FAILED}
        message={failure}
        actionLabel="Try again"
        onAction={() => void read(shared)}
      />,
    );
  }

  return page(
    <View
      accessible
      accessibilityLabel={SHARE_READING}
      accessibilityState={{ busy: true }}
      style={{ alignItems: 'center', gap: spacing[3], paddingTop: spacing[8] }}
    >
      <Spinner size={s(32)} color="brand" />
      <Text variant="body" style={{ color: colors.textBody }}>
        {SHARE_READING}
      </Text>
    </View>,
  );
}
