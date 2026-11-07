import { View } from 'react-native';

import {
  FIRST_RESUME_ART,
  FIRST_RESUME_TITLE,
  FIRST_RESUME_UPLOAD,
  FirstResumeOption,
} from '@/features/create/screens/FirstResumeScreen';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { OptionSheetHeader } from '@/ui/OptionSheet';
import { Sheet } from '@/ui/Sheet';

export const FIRST_RESUME_PROMPT_LEDE = 'Upload yours, or answer a few quick questions.';

export type FirstResumePromptProps = {
  open: boolean;
  onUpload: () => void;
  /** The one-question-per-screen details flow (Zero Resume). */
  onFillDetails: () => void;
  /** "Not now": asked again on the next app launch, never on this one. */
  onLater: () => void;
};

/**
 * Home's first-resume pop-up (owner, 2026-11-08, §185), replacing the "Your first resume" card:
 * someone with no resume yet is asked, once per launch, to upload one or to fill in their details
 * one question per screen. The same two choices, drawn the same way, as the start screen.
 */
export function FirstResumePrompt({
  open,
  onUpload,
  onFillDetails,
  onLater,
}: FirstResumePromptProps) {
  const { u } = useTheme();
  const styles = useStyles();
  return (
    <Sheet
      open={open}
      onClose={onLater}
      height={u(460)}
      accessibilityLabel={FIRST_RESUME_TITLE}
      contentStyle={styles.pad}
    >
      <OptionSheetHeader
        variant="card"
        title={FIRST_RESUME_TITLE}
        subtitle={FIRST_RESUME_PROMPT_LEDE}
        onClose={onLater}
      />
      <View style={styles.options}>
        <FirstResumeOption
          title={FIRST_RESUME_UPLOAD}
          body="PDF or DOCX. We’ll read it for you."
          art={FIRST_RESUME_ART.upload}
          badge="FASTEST"
          onPress={onUpload}
        />
        <FirstResumeOption
          title="Fill in my details"
          body="A few quick questions, one at a time."
          art={FIRST_RESUME_ART.scratch}
          onPress={onFillDetails}
        />
      </View>
      <Button label="Not now" variant="ghost" block onPress={onLater} style={styles.later} />
    </Sheet>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  pad: { paddingHorizontal: u(24), paddingBottom: u(12) },
  options: { gap: u(12), marginTop: u(8) },
  later: { marginTop: u(8) },
}));
