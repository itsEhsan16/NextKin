import { View } from 'react-native';

import type { ZeroCheckItem, ZeroResolution } from '@/data/models';
import { scaledSheet } from '@/theme';
import { ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';
import { Reveal } from '@/ui/motion';

import { EducationCheckForm, RoleCheckForm, SkillCheckForm } from './ZeroCheckForms';

const itemKey = (item: ZeroCheckItem): string =>
  item.kind === 'role'
    ? `role:${item.role.id}`
    : item.kind === 'skill'
      ? `skill:${item.skill}`
      : `edu:${item.entry.id}`;

/**
 * Zero Resume's check, one guess per screen (owner, 2026-11-07: "one thing at a time", §175):
 * how far along you are, then the single guess being answered — a role, one skill, or a school —
 * with its own Save and Delete. Answering it brings the next one in. Download stays locked until
 * every guess is checked (owner, 2026-11-06).
 */
export function ZeroReview({
  item,
  checked,
  total,
  busy,
  error,
  onResolve,
}: {
  item: ZeroCheckItem | undefined;
  checked: number;
  total: number;
  busy: boolean;
  error?: string;
  onResolve: (resolution: ZeroResolution) => void;
}) {
  const styles = useStyles();
  const form = { subtitle: '', busy, error, onResolve };
  const position = Math.min(checked + 1, total);

  return (
    <View style={styles.wrap}>
      <View style={styles.progress} accessible accessibilityLabel={`Guess ${position} of ${total}`}>
        <Text variant="footnote" color="brand">
          {`Guess ${position} of ${total}`}
        </Text>
        <ProgressBar
          value={total ? checked / total : 0}
          fillColor="brand"
          trackColor="progressTrack"
        />
      </View>

      {item ? (
        // Each guess fades in as the last one is answered.
        <Reveal stateKey={itemKey(item)}>
          {item.kind === 'role' ? (
            <RoleCheckForm role={item.role} {...form} />
          ) : item.kind === 'skill' ? (
            <SkillCheckForm skill={item.skill} {...form} />
          ) : (
            <EducationCheckForm entry={item.entry} {...form} />
          )}
        </Reveal>
      ) : null}

      <Text variant="footnote" color="textTertiary">
        Only you know these details. Download unlocks after the last one.
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  wrap: { gap: u(24), paddingTop: u(12) },
  progress: { gap: u(8) },
}));
