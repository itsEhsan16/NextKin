import { Image } from 'expo-image';
import { View } from 'react-native';

import type { ResumeContent } from '@/data/models';
import { FlowCard, FlowDivider, FlowRow, StatusPill } from '@/features/create/flow/FlowKit';
import { a11yHeader } from '@/lib';
import { motion, scaledSheet } from '@/theme';
import { Text } from '@/ui/Text';

const ILLUSTRATION = require('../../../../assets/illustrations/redesign/resume-ready.webp');

export type ZeroReadyProps = {
  content: ResumeContent;
  name: string;
  /** The job "Start from nothing" was picked on; the next step names it. */
  company?: string;
  /** Opens Build Resume from this resume. */
  onTailor: () => void;
  /** Opens the editor. */
  onEdit: () => void;
};

/**
 * Zero Resume's finish (toreview §173, Figma "Zero · 3 Ready"): every guess checked, the resume
 * saved, and the next things to do as real actions — tailoring it to a job was a static note.
 */
export function ZeroReady({ content, company, onTailor, onEdit }: ZeroReadyProps) {
  const styles = useStyles();
  const total = content.review?.total ?? 0;

  return (
    <View style={styles.wrap}>
      <StatusPill label={total > 0 ? `All ${total} checked` : 'All checked'} icon="Check" />
      <Image
        source={ILLUSTRATION}
        style={styles.art}
        contentFit="contain"
        accessible={false}
        cachePolicy="memory"
        transition={motion.durations.imageFade}
      />
      <View style={styles.titleBlock}>
        <Text variant="title1" color="ink" {...a11yHeader()}>
          Your first resume is ready
        </Text>
        <Text variant="bodyLg" color="textSecondary">
          Saved to Resumes and your profile.
        </Text>
      </View>
      <FlowCard style={styles.next}>
        <FlowRow
          icon="Target"
          title={company ? `Tailor it to the ${company} job` : 'Tailor it to a job'}
          body="Get a higher match for one role"
          onPress={onTailor}
        />
        <FlowDivider />
        <FlowRow
          icon="Edit03"
          title="Review it in the editor"
          body="Fonts, order, sections"
          onPress={onEdit}
        />
      </FlowCard>
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  wrap: { gap: u(16), paddingTop: u(8) },
  art: { width: u(150), height: u(150) },
  titleBlock: { gap: u(6) },
  next: { paddingVertical: u(4) },
}));
