import { View } from 'react-native';

import {
  zeroCheckRows,
  type ResumeContent,
  type ZeroCheckItem,
  type ZeroResolution,
} from '@/data/models';
import { FlowCard, FlowDivider, FlowRow, IconTile } from '@/features/create/flow/FlowKit';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

import { EducationCheckForm, RoleCheckForm } from './ZeroCheckForms';

const GROUP_ICON = {
  roles: 'Briefcase01',
  companies: 'Building02',
  skills: 'Tool02',
  education: 'GraduationHat01',
} as const;

const itemKey = (item: ZeroCheckItem): string =>
  item.kind === 'role'
    ? `role:${item.role.id}`
    : item.kind === 'skill'
      ? `skill:${item.skill}`
      : `edu:${item.entry.id}`;

/** Every guessed skill at once: Keep confirms it as written, Remove drops it. */
function SkillsCard({
  skills,
  busy,
  onResolve,
}: {
  skills: readonly string[];
  busy: boolean;
  onResolve: (resolution: ZeroResolution) => void;
}) {
  const styles = useStyles();
  return (
    <FlowCard highlight style={styles.current}>
      <Text variant="title3" color="ink">
        Do you have these skills?
      </Text>
      <Text variant="callout" color="textSecondary">
        Keep the ones you really have.
      </Text>
      <View style={styles.skills}>
        {skills.map((skill, index) => (
          <View key={skill}>
            {index > 0 ? <FlowDivider /> : null}
            <View style={styles.skillRow}>
              <Text variant="bodyLgStrong" color="ink" style={styles.flex}>
                {skill}
              </Text>
              <Button
                label="Remove"
                variant="ghost"
                size="md"
                disabled={busy}
                onPress={() => onResolve({ kind: 'skill', skill, remove: true })}
                style={styles.smallBtn}
              />
              <Button
                label="Keep"
                variant="soft"
                size="md"
                icon="Check"
                disabled={busy}
                onPress={() => onResolve({ kind: 'skill', skill, name: skill })}
                style={styles.smallBtn}
              />
            </View>
          </View>
        ))}
      </View>
    </FlowCard>
  );
}

/**
 * Zero Resume's check step on one screen (toreview §173, Figma "Zero · 2 Review guesses"): how many
 * are checked, the guess being answered as an open card with its fields inline, every skill at
 * once, then what is left. Download stays locked until all are checked (owner, 2026-11-06).
 */
export function ZeroReview({
  content,
  item,
  checked,
  total,
  busy,
  error,
  onResolve,
}: {
  content: ResumeContent;
  item: ZeroCheckItem | undefined;
  checked: number;
  total: number;
  busy: boolean;
  error?: string;
  onResolve: (resolution: ZeroResolution) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const rows = zeroCheckRows(content);
  const form = { subtitle: '', busy, error, onResolve };

  return (
    <View style={styles.wrap}>
      <View style={styles.titleBlock}>
        <Text variant="title1" color="ink" accessibilityRole="header">
          {`Check ${total} guesses`}
        </Text>
        <Text variant="bodyLg" color="textSecondary">
          Only you know these details.
        </Text>
      </View>
      <View
        style={styles.progress}
        accessible
        accessibilityLabel={`${checked} of ${total} checked`}
      >
        <View style={styles.flex}>
          <ProgressBar
            value={total ? checked / total : 0}
            fillColor="brand"
            trackColor="progressTrack"
          />
        </View>
        <Text variant="footnote" color="brand">
          {`${checked} of ${total}`}
        </Text>
      </View>

      {item?.kind === 'skill' ? (
        <SkillsCard
          skills={content.review?.pendingSkills ?? [item.skill]}
          busy={busy}
          onResolve={onResolve}
        />
      ) : item ? (
        <FlowCard highlight style={styles.current}>
          {item.kind === 'role' ? (
            <RoleCheckForm key={itemKey(item)} role={item.role} {...form} />
          ) : (
            <EducationCheckForm key={itemKey(item)} entry={item.entry} {...form} />
          )}
        </FlowCard>
      ) : null}

      <FlowCard flat style={styles.list}>
        {rows.map((row, index) => (
          <View key={row.group}>
            {index > 0 ? <FlowDivider /> : null}
            <FlowRow
              icon={GROUP_ICON[row.group]}
              title={row.title}
              body={row.detail}
              trailing={
                row.done ? (
                  <IconTile name="Check" size={24} tone="success" />
                ) : (
                  <View
                    style={[styles.todo, { borderColor: colors.progressTrack }]}
                    accessibilityLabel="Not checked yet"
                  />
                )
              }
            />
          </View>
        ))}
      </FlowCard>
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  wrap: { gap: u(20), paddingTop: u(12) },
  titleBlock: { gap: u(6) },
  progress: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  flex: { flex: 1 },
  current: { gap: u(8) },
  skills: { marginTop: u(6) },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: u(8), paddingVertical: u(10) },
  smallBtn: { height: u(38), paddingHorizontal: u(14), borderRadius: u(999) },
  list: { paddingVertical: u(4) },
  todo: { width: u(24), height: u(24), borderRadius: u(12), borderWidth: 2 },
}));
