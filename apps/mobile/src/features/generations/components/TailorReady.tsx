import type { ReactNode } from 'react';
import { View } from 'react-native';

import { StatusPill } from '@/features/create/flow/FlowKit';
// Deep import on purpose: the profile barrel drags its screens in.
import { a11yHeader } from '@/lib';
import { scaledSheet } from '@/theme';
import { Text } from '@/ui/Text';

export type TailorReadyProps = {
  company?: string;
  /** Another flow's pill beside "Saved to Resumes" (Build's band). */
  pill?: ReactNode;
  /** What to do next, at the end: the cover-letter tile (owner, 2026-11-19, §237). */
  next?: ReactNode;
  /** The page preview, drawn under the title. */
  preview?: ReactNode;
};

/**
 * A finished resume (toreview §173, Figma "Build · 3 Ready"): "Saved to Resumes", the title, the
 * page preview (its ring carries the score), then what to do next. Tailor and Build share it.
 * Owner, 2026-11-19 (§237): the score row and the "download it, then apply" note are gone.
 */
export function TailorReady({ company, pill, next, preview }: TailorReadyProps) {
  const styles = useStyles();
  const title = company ? `Your resume for ${company} is ready` : 'Your resume is ready';

  return (
    <View style={styles.wrap}>
      <View style={styles.pills}>
        <StatusPill label="Saved to Resumes" icon="Check" />
        {pill}
      </View>
      <Text {...a11yHeader()} variant="title1" color="ink">
        {title}
      </Text>
      {preview}
      {next}
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  wrap: { gap: u(16), paddingTop: u(4), width: '100%' },
  pills: { flexDirection: 'row', alignItems: 'center', gap: u(8), flexWrap: 'wrap' },
}));
