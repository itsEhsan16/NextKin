import { View } from 'react-native';

import type { Job } from '@/data/models';
import { a11yButton, a11yHeader, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { JD_MAX, PASTE_TIP, type AtsJobMode } from '../atsCheckSetup';
import { AtsJobRow, PasteJdTile, TipCard, UseSavedJobLink } from './AtsCheckRows';

// ATS 01 / 01b at 390 (645:26 → 645:91), in artboard units.
const ROW_GAP = 10 / 0.75; // 645:26, 645:36
const FILE_TO_HEAD = 18 / 0.75; // 645:72
const HEAD_TO_FIELD = 10 / 0.75; // 645:76
const FIELD_TO_TIP = 10 / 0.75; // 645:81
const TIP_TO_LINK = 14 / 0.75; // 645:90
const FIELD_LINES = 5;
const CLEAR_H = 16 / 0.75;

export type AtsJobPartProps = {
  mode: AtsJobMode;
  /** The saved job the check would run against; none when nothing is saved. */
  job?: Job;
  pasted: string;
  onPaste: (text: string) => void;
  onChangeJob: () => void;
  onPasteMode: () => void;
  onJobMode: () => void;
  /** Said under the field once a check was refused for too little text. */
  pasteError?: string;
};

/**
 * What the resume is checked against. ATS 01: the saved job with Change, and the dashed way to a
 * job that is not on NextKin. ATS 01b: the pasted description with Clear and its count, the tip,
 * and the way back to the saved job.
 */
export function AtsJobPart({
  mode,
  job,
  pasted,
  onPaste,
  onChangeJob,
  onPasteMode,
  onJobMode,
  pasteError,
}: AtsJobPartProps) {
  const { s } = useTheme();
  const styles = useStyles();

  if (mode === 'job') {
    return (
      <View>
        {job ? (
          <View style={styles.gap}>
            <AtsJobRow job={job} onChange={onChangeJob} />
          </View>
        ) : null}
        <View style={styles.gap}>
          <PasteJdTile onPress={onPasteMode} />
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.head}>
        <Text variant="title" style={styles.grow} {...a11yHeader('Job description')}>
          Job description
        </Text>
        {pasted.length > 0 ? (
          <Pressable
            {...a11yButton('Clear', 'Empties the job description')}
            feedback="subtle"
            haptic="light"
            hitSlop={hitSlopFor(s(CLEAR_H))}
            onPress={() => onPaste('')}
          >
            <Text variant="captionSemiBold" color="brand">
              Clear
            </Text>
          </Pressable>
        ) : null}
      </View>
      <TextField
        value={pasted}
        onChangeText={onPaste}
        accessibilityLabel="Paste the job description"
        placeholder="Paste the whole job description here"
        multiline
        minLines={FIELD_LINES}
        maxLength={JD_MAX}
        showCount
        error={pasteError}
        style={styles.field}
      />
      <View style={styles.tip}>
        <TipCard text={PASTE_TIP} />
      </View>
      {job ? (
        <View style={styles.link}>
          <UseSavedJobLink onPress={onJobMode} />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  gap: { marginTop: s(ROW_GAP) },
  head: { marginTop: s(FILE_TO_HEAD), flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  field: { marginTop: s(HEAD_TO_FIELD) },
  tip: { marginTop: s(FIELD_TO_TIP) },
  link: { marginTop: s(TIP_TO_LINK) },
}));
