import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { JdInput } from '@/data/models';
import { useJob } from '@/data/queries';
import { pickDocument, useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SheetRow } from '@/ui/SheetRow';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { useCreateStore } from '../createStore';

/**
 * These props are HALF the component. The screen must also mount `<JdIntakeSheets value onChange />`
 * as a sibling of its `<Screen>` — a `Sheet` rendered inside the page's scroller would scrim the
 * scrolling content instead of the window, so the saved-job picker cannot live in here. Mount the
 * section alone and "From a job you saved" is a dead tap: the store flips and nothing opens.
 */
export type JdIntakeSectionProps = {
  value: JdInput | null;
  onChange: (input: JdInput | null) => void;
  /** Set when the flow started from a listing: the picker collapses to that job. */
  jobId?: string;
};

/** Long enough for the longest posting anyone pastes; the counter shows the ceiling. */
const MAX_JD = 12000;
const MIN_LINES = 6;
const TITLE_SKELETON = 18;
const CAPTION_SKELETON = 14;

const CHOICES = [
  {
    key: 'paste',
    icon: 'paste',
    label: 'Paste the description',
    description: 'Copy the posting and drop the text in',
  },
  { key: 'file', icon: 'file-upload', label: 'Upload a file', description: 'PDF, DOCX or TXT' },
  {
    key: 'job',
    icon: 'bookmark',
    label: 'From a job you saved',
    description: 'Pick one of the jobs on your saved list',
  },
] as const;

type JdMode = (typeof CHOICES)[number]['key'];

/**
 * The input a screen opened from a listing starts with. Seed state with this rather than letting
 * the section adopt the id in an effect: the value is known at the first render, and syncing it
 * afterwards is a cascading render for nothing.
 */
export const jdInputForJob = (jobId?: string): JdInput | null =>
  jobId ? { source: 'job', jobId } : null;

/**
 * The job-description intake (V2 §7.5): three ways in — paste, upload, or a job already saved —
 * and, once one is picked, the editor for it. Shared by every create flow that needs a JD
 * (tailoring, cover letters, ATS checks, Zero Resume), so it owns nothing but the input.
 *
 * `value` carries the mode once anything has been entered, so no second copy of "which path am I
 * on" can fall out of step with it; `pendingMode` covers only the gap between choosing "Upload a
 * file" and having one.
 */
export function JdIntakeSection({ value, onChange, jobId }: JdIntakeSectionProps) {
  const { motion, spacing, s } = useTheme();
  const reduced = useReducedMotion();
  const openJobSheet = useJdIntakeStore((state) => state.openJobSheet);

  const [pendingMode, setPendingMode] = useState<JdMode | null>(null);
  const [changing, setChanging] = useState(false);
  const [picking, setPicking] = useState(false);

  const mode: JdMode | null = value?.source ?? pendingMode;
  // One query for both job branches: locked to a listing, the two ids are the same one.
  const job = useJob(value?.source === 'job' ? value.jobId : (jobId ?? ''));

  const reset = useCallback(() => {
    setPendingMode(null);
    setChanging(true);
    onChange(null);
  }, [onChange]);

  const upload = useCallback(async () => {
    setPicking(true);
    try {
      const file = await pickDocument(['pdf', 'docx', 'txt']);
      // A cancel — or expo-document-picker being unavailable in Expo Go — is not an error: the
      // mode stays where it was and nothing is said.
      if (file) onChange({ source: 'file', file });
    } finally {
      setPicking(false);
    }
  }, [onChange]);

  const section = (children: ReactNode) => (
    <View style={{ gap: spacing[3] }}>
      <Text variant="groupLabel">Job description</Text>
      {children}
    </View>
  );

  const jobSummary = (
    <Card radius="card">
      {job.isPending ? (
        <View style={{ gap: spacing[2] }}>
          <Skeleton width="70%" height={s(TITLE_SKELETON)} />
          <Skeleton width="45%" height={s(CAPTION_SKELETON)} />
        </View>
      ) : (
        <View style={{ gap: spacing[1] }}>
          <Text variant="title" numberOfLines={2}>
            {job.data?.title ?? 'Saved job'}
          </Text>
          {job.data?.company ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {job.data.company}
            </Text>
          ) : null}
        </View>
      )}
    </Card>
  );

  const changeSource = (
    <Button
      label="Use a different source"
      variant="ghost"
      onPress={reset}
      style={styles.startAligned}
    />
  );

  // Opened from a listing: the JD is already decided, so the picker collapses to what it knows
  // and "Change" hands the choice back rather than hiding it.
  if (jobId && !changing) {
    return section(
      <View style={{ gap: spacing[3] }}>
        {jobSummary}
        <Button label="Change" variant="ghost" onPress={reset} style={styles.startAligned} />
      </View>,
    );
  }

  if (mode === null) {
    return section(
      <Card radius="card">
        <View style={{ gap: spacing[4] }}>
          {CHOICES.map((choice, index) => (
            <Animated.View
              key={choice.key}
              entering={
                reduced
                  ? undefined
                  : FadeInDown.delay(index * motion.stagger.row).duration(motion.durations.base)
              }
            >
              <SheetRow
                icon={choice.icon}
                label={choice.label}
                description={choice.description}
                onPress={() => {
                  if (choice.key === 'job') return openJobSheet();
                  if (choice.key === 'paste') return onChange({ source: 'paste', text: '' });
                  setPendingMode('file');
                }}
              />
            </Animated.View>
          ))}
        </View>
      </Card>,
    );
  }

  if (mode === 'paste') {
    // The field's own label is the section's, so the heading above is not drawn twice.
    return (
      <View style={{ gap: spacing[3] }}>
        <TextField
          label="Job description"
          value={value?.source === 'paste' ? value.text : ''}
          onChangeText={(text) => onChange({ source: 'paste', text })}
          placeholder="Paste the whole posting — we read the requirements out of it"
          multiline
          minLines={MIN_LINES}
          maxLength={MAX_JD}
          showCount
        />
        {changeSource}
      </View>
    );
  }

  if (mode === 'file') {
    const file = value?.source === 'file' ? value.file : null;
    return section(
      <View style={{ gap: spacing[3] }}>
        {file ? (
          <Card radius="card">
            <Text variant="title" numberOfLines={2}>
              {file.name}
            </Text>
            <Text variant="caption" color="textSecondary" style={{ marginTop: spacing[1] }}>
              Ready to read
            </Text>
          </Card>
        ) : null}
        <Button
          label={file ? 'Choose a different file' : 'Choose a file'}
          variant="ghost"
          icon="file-upload"
          loading={picking}
          onPress={() => void upload()}
          style={styles.startAligned}
        />
        {changeSource}
      </View>,
    );
  }

  return section(
    <View style={{ gap: spacing[3] }}>
      {jobSummary}
      <Button
        label="Choose a different job"
        variant="ghost"
        onPress={openJobSheet}
        style={styles.startAligned}
      />
      {changeSource}
    </View>,
  );
}

const styles = StyleSheet.create({
  startAligned: { alignSelf: 'flex-start' },
});
