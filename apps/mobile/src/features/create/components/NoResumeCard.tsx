import { View } from 'react-native';

import { ProfileCard } from '@/features/profile/components/cards';
import { a11yHeader } from '@/lib';
import { useTheme } from '@/theme';
import { SheetRow } from '@/ui/SheetRow';
import { Text } from '@/ui/Text';

export type NoResumeCardProps = {
  /** "Upload your resume": the TAILOR 01 sheet, which reads the file and compares it. */
  onUpload: () => void;
  /** Set when the profile has roles: build one from it for this job (BUILD 04b/04c). */
  onBuild?: () => void;
  /** Set when there is no profile to build from: Zero Resume, the role taken from the job. */
  onStartFromNothing?: () => void;
};

/**
 * The Customize screen with nothing to tailor (toreview §114): upload a resume, build one from the
 * profile, or start from nothing. Spec-derived from ZERO 00b's choice, as one card on the page.
 */
export function NoResumeCard({ onUpload, onBuild, onStartFromNothing }: NoResumeCardProps) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing[3] }}>
      <Text {...a11yHeader()} variant="title">
        First, a resume to work from
      </Text>
      <ProfileCard>
        <View style={{ padding: spacing[4], gap: spacing[4] }}>
          <SheetRow
            icon="file-upload"
            label="Upload your resume"
            description="PDF or DOCX. We compare it with this job."
            onPress={onUpload}
          />
          {onBuild ? (
            <SheetRow
              icon="user"
              label="Build from my profile"
              description="We write one for this job from your profile."
              ai
              onPress={onBuild}
            />
          ) : null}
          {onStartFromNothing ? (
            <SheetRow
              icon="magic"
              label="Start from nothing"
              description="Three questions, and we draft the rest."
              ai
              onPress={onStartFromNothing}
            />
          ) : null}
        </View>
      </ProfileCard>
    </View>
  );
}
