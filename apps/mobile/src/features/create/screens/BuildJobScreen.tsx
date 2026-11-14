import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { JD_CLOSED_NOTE, JD_CLOSED_TITLE, jdHasClosed, type Job, type JdFile } from '@/data/models';
import {
  isUnreadableLinkError,
  jdFailureMessage,
  jdFailureReason,
  useCurrentUser,
  useExtractJd,
  useJobPicks,
  useProfile,
  useResumes,
  useSavedJobs,
} from '@/data/queries';
import { pickDocument, useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { SearchField } from '@/ui/SearchField';
import { SegmentedControl, type Segment } from '@/ui/SegmentedControl';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { useBuildSource, useBuildSourceStore } from '../buildSourceStore';
import { BuildJobCard, BuildJobRow, BuildJobRowsSkeleton } from '../components/BuildJobRows';
import { BuildSourcePill } from '../components/BuildSourcePill';
import { BuildSourceSheet } from '../components/BuildSourceSheet';
import { OnboardingFrame } from '../components/OnboardingFrame';
import { useBuildSourceUpload } from '../hooks/useBuildSourceUpload';
import { useBuildActions } from '../hooks/useStartBuild';
import { buildAddInput } from '../buildInput';

export const BUILD_STEPS = 3;
export const BUILD_JOB_TITLE = 'Which job is it for?';
const LEDE = 'Paste a job, or pick one you saved.';
const READ_FAILED = 'We couldn’t read that job. Try again.';
const BLOCKED = 'That site blocks reading. Paste the job description instead.';
const CLOSED = `${JD_CLOSED_TITLE}. ${JD_CLOSED_NOTE}`;
const TOO_BIG = 'That file is over 5 MB.';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const SEARCH_FROM = 5;

type Tab = 'saved' | 'top';

const matches = (job: Job, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return job.title.toLowerCase().includes(needle) || job.company.toLowerCase().includes(needle);
};

export type BuildJobScreenProps = {
  /** The resume to start from, when the flow was opened from one. */
  resumeId?: string;
  /** Pre-filled paste text (a share, or a return from elsewhere). */
  paste?: string;
  /** Why they've landed here: a shared link whose site won't be read. */
  notice?: string;
};

/**
 * Build Resume, step 1 of 3 (toreview.md §172): one screen for the job. Paste a link or the
 * description (a link is told apart by itself), or upload a file, or tap a saved job / top match.
 * Replaces BUILD 01, 02, 03 and 05b. Tapping a job, or Continue on a pasted one, goes straight to
 * the match; nothing is spent until the build itself.
 */
export function BuildJobScreen({ resumeId: requested, paste, notice }: BuildJobScreenProps) {
  const reduced = useReducedMotion();
  const { colors, motion } = useTheme();
  const styles = useStyles();
  const actions = useBuildActions();
  const extract = useExtractJd();

  const saved = useSavedJobs();
  const picks = useJobPicks();
  const profile = useProfile();
  const user = useCurrentUser();
  const resumes = useResumes();
  const resumeId = useBuildSource();
  const pick = useBuildSourceStore((state) => state.pick);
  const reset = useBuildSourceStore((state) => state.reset);
  const [sourceOpen, setSourceOpen] = useState(false);
  const sourceUpload = useBuildSourceUpload();

  const [text, setText] = useState(paste ?? '');
  const [file, setFile] = useState<JdFile | null>(null);
  const [failure, setFailure] = useState<string | undefined>(notice);
  const [tab, setTab] = useState<Tab>('saved');
  const [query, setQuery] = useState('');
  const busy = useRef(false);
  // A posting that was read but has closed (toreview §206): said here, then Continue goes on.
  const [closedId, setClosedId] = useState<string | undefined>();

  useEffect(() => {
    if (requested) pick(requested);
    return reset;
  }, [pick, requested, reset]);

  const input = buildAddInput(text, file);
  const reading = extract.isPending;

  const fail = (message: string) => {
    setFailure(message);
    AccessibilityInfo.announceForAccessibility(message);
  };

  const upload = async () => {
    const picked = await pickDocument(['pdf', 'docx', 'doc', 'txt']);
    if (!picked) return;
    if (picked.size != null && picked.size > MAX_FILE_BYTES) return fail(TOO_BIG);
    setFailure(undefined);
    setClosedId(undefined);
    setFile(picked);
    setText('');
  };

  const readPasted = async () => {
    if (!input || busy.current) return;
    if (closedId) return actions.openCompare({ jdId: closedId });
    busy.current = true;
    setFailure(undefined);
    try {
      const draft = await extract.mutateAsync(input);
      if (jdHasClosed(draft)) {
        setClosedId(draft.id);
        fail(CLOSED);
        return;
      }
      actions.openCompare({ jdId: draft.id });
    } catch (error) {
      // A list of jobs or a posting that is gone is said in the server's words; a site that
      // refuses keeps the short line this screen has always shown.
      const reason = jdFailureReason(error);
      const said =
        reason && reason !== 'refused' && reason !== 'robots' ? jdFailureMessage(error) : null;
      fail(
        said ?? (input.source === 'link' && isUnreadableLinkError(error) ? BLOCKED : READ_FAILED),
      );
    } finally {
      busy.current = false;
    }
  };

  const source = tab === 'saved' ? saved : picks;
  const all = useMemo(() => source.data ?? [], [source.data]);
  const list = useMemo(() => all.filter((job) => matches(job, query)), [all, query]);

  let jobs: ReactNode;
  if (source.isError) {
    jobs = (
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn’t load jobs"
        actionLabel="Try again"
        onAction={() => void source.refetch()}
      />
    );
  } else if (!source.data) {
    jobs = <BuildJobRowsSkeleton count={3} />;
  } else if (all.length === 0) {
    jobs = (
      <View style={[styles.empty, { backgroundColor: colors.surfaceFaint }]}>
        <Text variant="callout" color="textSecondary" align="center">
          {tab === 'saved' ? 'No saved jobs yet.' : 'No matches yet.'}
        </Text>
        <Button label="Browse jobs" variant="outline" onPress={actions.browseJobs} />
      </View>
    );
  } else if (list.length === 0) {
    jobs = (
      <Text variant="callout" color="textSecondary" align="center" style={styles.none}>
        No jobs match “{query.trim()}”.
      </Text>
    );
  } else {
    jobs = (
      <BuildJobCard>
        {list.map((job) => (
          <BuildJobRow
            key={job.id}
            job={job}
            variant="link"
            onPress={() => actions.openCompare({ jobId: job.id })}
          />
        ))}
      </BuildJobCard>
    );
  }

  const roles = profile.data?.experiences.length;
  const skills = profile.data?.skills.length;
  const picked = resumeId ? resumes.data?.find((resume) => resume.id === resumeId) : undefined;
  const profileSource =
    roles != null && skills != null
      ? { name: user.data?.firstName ?? '', avatarUrl: user.data?.avatarUrl, roles, skills }
      : undefined;

  const segments: readonly Segment<Tab>[] = [
    { key: 'saved', label: saved.data ? `Saved (${saved.data.length})` : 'Saved' },
    { key: 'top', label: 'Top matches' },
  ];

  return (
    <OnboardingFrame
      step={1}
      total={BUILD_STEPS}
      title={BUILD_JOB_TITLE}
      subtitle={LEDE}
      onBack={actions.goBack}
      aside={
        profileSource ? (
          <BuildSourcePill
            source={
              sourceUpload.reading
                ? { kind: 'reading', fileName: sourceUpload.reading }
                : picked
                  ? { kind: 'resume', resume: picked }
                  : { kind: 'profile', ...profileSource }
            }
            onPress={() => setSourceOpen(true)}
          />
        ) : undefined
      }
      footer={
        input ? (
          <Animated.View entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}>
            <Button
              label={reading ? 'Reading the job…' : closedId ? 'Continue anyway' : 'Continue'}
              size="xl"
              block
              loading={reading}
              onPress={() => void readPasted()}
            />
          </Animated.View>
        ) : undefined
      }
    >
      {file ? (
        <View style={[styles.file, { backgroundColor: colors.brandSurface }]}>
          <Icon name="File04" size="md" color={colors.brand} />
          <Text variant="bodyLgStrong" color="ink" numberOfLines={1} style={styles.fill}>
            {file.name}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove file"
            feedback="subtle"
            onPress={() => {
              setFile(null);
              setClosedId(undefined);
            }}
          >
            <Icon name="XClose" size="sm" color={colors.iconDefault} />
          </Pressable>
        </View>
      ) : (
        <TextField
          accessibilityLabel="Job link or description"
          placeholder="Paste a job link or description"
          icon="Link01"
          value={text}
          multiline
          minLines={2}
          onChangeText={(next) => {
            setText(next);
            setFailure(undefined);
            setClosedId(undefined);
          }}
          error={failure}
        />
      )}
      {!file ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Upload a job file"
          feedback="subtle"
          onPress={() => void upload()}
          style={styles.upload}
        >
          <Icon name="UploadCloud02" size="sm" color={colors.brand} />
          <Text variant="footnote" color="brand">
            Upload a file instead
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.divider}>
        <View style={[styles.rule, { backgroundColor: colors.divider }]} />
        <Text variant="eyebrow" color="textTertiary">
          OR PICK A JOB
        </Text>
        <View style={[styles.rule, { backgroundColor: colors.divider }]} />
      </View>

      <SegmentedControl segments={segments} value={tab} onChange={setTab} />
      {all.length >= SEARCH_FROM ? (
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search jobs"
          style={styles.search}
        />
      ) : null}
      <View style={styles.list}>{jobs}</View>

      {profileSource ? (
        <BuildSourceSheet
          open={sourceOpen}
          onClose={() => setSourceOpen(false)}
          profile={profileSource}
          resumes={resumes.data}
          resumeId={picked ? picked.id : null}
          onPick={pick}
          onUpload={() => void sourceUpload.upload()}
        />
      ) : null}
    </OnboardingFrame>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  fill: { flex: 1 },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(12),
    padding: u(16),
    borderRadius: u(16),
  },
  upload: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(6),
    alignSelf: 'flex-start',
    paddingVertical: u(10),
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: u(10), marginVertical: u(20) },
  rule: { flex: 1, height: 1 },
  search: { marginTop: u(12) },
  list: { marginTop: u(12) },
  empty: { alignItems: 'center', gap: u(12), padding: u(20), borderRadius: u(20) },
  none: { paddingVertical: u(16) },
}));
