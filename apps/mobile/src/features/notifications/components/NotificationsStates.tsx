import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';

import SparkleIcon from '../../../../assets/icons/ai-sparkle.svg';
import { a11yButton, a11yHeader } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

const MARK = 96;
const MARK_ICON = 36;

/** NOTIF 05 (Figma 1:2766) — the feed with nothing left to show under the active filter. */
export function NotificationsCaughtUp({ onExplore }: { onExplore: () => void }) {
  const { colors, radii, spacing } = useTheme();

  return (
    <View style={[styles.center, { paddingVertical: spacing[12], gap: spacing[3] }]}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: MARK,
          height: MARK,
          borderRadius: radii.emptyTile,
          backgroundColor: colors.successSurface,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing[3],
        }}
      >
        <FontAwesome5 name="check" size={MARK_ICON} color={colors.success} solid />
      </View>
      <Text {...a11yHeader()} variant="headline" align="center">
        {"You're all caught up"}
      </Text>
      <Text variant="body" color="textSecondary" align="center" style={styles.lede}>
        New matches, application updates and AI results will land here.
      </Text>
      <Button
        label="Explore today's matches"
        onPress={onExplore}
        style={{ marginTop: spacing[4] }}
      />
    </View>
  );
}

/** One "what arrives" row of NOTIF 06 (Figma 1:2798). */
type ArrivalRow = {
  key: string;
  kind: 'sparkle' | 'glyph';
  icon?: string;
  tone: 'brand' | 'warning' | 'neutral';
  title: string;
  caption: string;
};

const ARRIVALS: readonly ArrivalRow[] = [
  {
    key: 'matches',
    kind: 'sparkle',
    tone: 'brand',
    title: 'New matches',
    caption: 'One batch a day, refreshed each morning',
  },
  {
    key: 'closing',
    kind: 'glyph',
    icon: 'clock',
    tone: 'warning',
    title: 'Saved jobs closing',
    caption: '48 hours before the deadline',
  },
  {
    key: 'applications',
    kind: 'glyph',
    icon: 'briefcase',
    tone: 'neutral',
    title: 'Application updates',
    caption: 'Viewed, stage changes, decisions',
  },
  {
    key: 'ai',
    kind: 'glyph',
    icon: 'envelope',
    tone: 'brand',
    title: 'AI results',
    caption: 'Scores, cover letters, tailored drafts',
  },
] as const;

const TONE: Record<'brand' | 'warning' | 'neutral', { bg: ColorToken; fg: ColorToken }> = {
  brand: { bg: 'brandSurface', fg: 'brand' },
  warning: { bg: 'warningSurface', fg: 'warningStrong' },
  neutral: { bg: 'surfaceSubtle', fg: 'textBody' },
};

/** NOTIF 06 (Figma 1:2788) — the feed before anything has ever arrived. */
export function NotificationsFirstUse({ onPreferences }: { onPreferences: () => void }) {
  const { colors, radii, spacing } = useTheme();

  return (
    <View style={{ paddingVertical: spacing[6], gap: spacing[3] }}>
      <View style={styles.center}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: MARK,
            height: MARK,
            borderRadius: radii.emptyTile,
            backgroundColor: colors.surfaceSubtle,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing[5],
          }}
        >
          <FontAwesome5 name="bell" size={MARK_ICON} color={colors.iconMuted} />
        </View>
        <Text {...a11yHeader()} variant="displaySemiBold" align="center">
          Nothing here yet
        </Text>
        <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing[2] }}>
          This is what NextKin will tell you about:
        </Text>
      </View>

      <Card radius="card" padding={0} style={{ marginTop: spacing[4] }}>
        {ARRIVALS.map((row, index) => {
          const tone = TONE[row.tone];
          return (
            <View
              key={row.key}
              accessible
              accessibilityLabel={`${row.title}: ${row.caption}`}
              style={[styles.arrival, { gap: spacing[3], padding: spacing[4] - 1 }]}
            >
              {index > 0 ? (
                <View
                  style={[
                    styles.arrivalDivider,
                    { backgroundColor: colors.divider, left: 67 },
                  ]}
                />
              ) : null}
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 11,
                  backgroundColor: colors[tone.bg],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {row.kind === 'sparkle' ? (
                  <SparkleIcon width={14} height={14} color={colors.brand} />
                ) : (
                  <FontAwesome5 name={row.icon ?? ''} size={14} color={colors[tone.fg]} solid />
                )}
              </View>
              <View style={styles.arrivalText}>
                <Text variant="titleSm">{row.title}</Text>
                <Text variant="captionSm" color="textSecondary">
                  {row.caption}
                </Text>
              </View>
            </View>
          );
        })}
      </Card>

      <Pressable
        {...a11yButton('Choose what you get notified about')}
        feedback="scale"
        haptic="light"
        onPress={onPreferences}
        style={[
          styles.prefsCta,
          {
            borderRadius: radii.xl,
            borderColor: colors.borderDefault,
            backgroundColor: colors.surfaceCard,
            marginTop: spacing[4],
          },
        ]}
      >
        <Text variant="bodySemiBold" align="center">
          Choose what you get notified about
        </Text>
      </Pressable>
      <Text variant="caption" color="textSecondary" align="center">
        We only send what you switch on.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  lede: { maxWidth: 320 },
  arrival: { flexDirection: 'row', alignItems: 'center' },
  arrivalDivider: { position: 'absolute', top: 0, right: 0, height: StyleSheet.hairlineWidth },
  arrivalText: { flex: 1, gap: 1 },
  prefsCta: { height: 56, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
