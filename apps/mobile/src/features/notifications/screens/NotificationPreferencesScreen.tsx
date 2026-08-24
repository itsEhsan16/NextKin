import { StyleSheet, View } from 'react-native';

import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationPrefs,
} from '@/data/models';
import { useNotificationPrefs, useSetNotificationPrefs } from '@/data/queries';
import { a11yHeader, usePushPermission } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { AiBadge } from '@/ui/AiBadge';
import { Card } from '@/ui/Card';
import { IconButton } from '@/ui/IconButton';
import { Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { Toggle } from '@/ui/Toggle';

import { useNotificationsActions } from '../hooks/useNotificationsActions';

type PrefRowProps = {
  title: string;
  caption: string;
  ai?: boolean;
  value: boolean;
  divider: boolean;
  onChange: (value: boolean) => void;
};

function PrefRow({ title, caption, ai, value, divider, onChange }: PrefRowProps) {
  const { colors, spacing } = useTheme();
  const styles = useStyles();
  return (
    <View>
      {divider ? (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            marginHorizontal: 19,
            backgroundColor: colors.divider,
          }}
        />
      ) : null}
      <View style={[styles.prefRow, { paddingHorizontal: 19, paddingVertical: spacing[3] + 1, gap: spacing[3] }]}>
        <View style={styles.prefText}>
          <View style={[styles.prefTitle, { gap: spacing[2] }]}>
            <Text variant="label">{title}</Text>
            {ai ? <AiBadge /> : null}
          </View>
          <Text variant="rowDescription" color="textSecondary">
            {caption}
          </Text>
        </View>
        <Toggle value={value} onChange={onChange} label={title} />
      </View>
    </View>
  );
}

/** What the system-permission footer says in each state (Figma 1:2764 draws "on"). */
const PERMISSION_COPY = {
  granted: 'System permission is on. You can revoke it at any time in your device settings.',
  denied:
    'System permission is off. Turn it on in your device settings for anything to reach your lock screen.',
  undetermined:
    "You haven't allowed notifications yet — applying to a job will offer to turn them on.",
} as const;

/**
 * NOTIF 04 (Figma 1:2711) — five category switches, two delivery switches, and the live
 * system-permission line. Everything writes through the prefs repo optimistically.
 */
export function NotificationPreferencesScreen() {
  const { spacing } = useTheme();
  const styles = useStyles();
  const actions = useNotificationsActions();
  const { status } = usePushPermission();

  const prefs = useNotificationPrefs();
  const setPrefs = useSetNotificationPrefs();

  const patch = (partial: Partial<NotificationPrefs>) => {
    if (prefs.data) setPrefs.mutate({ ...prefs.data, ...partial });
  };
  const setCategory = (category: NotificationCategory, value: boolean) => {
    if (prefs.data) {
      patch({ categories: { ...prefs.data.categories, [category]: value } });
    }
  };

  return (
    <Screen scroll edges={['top', 'bottom']} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <View style={[styles.headerRow, { paddingTop: spacing[2] }]}>
        <IconButton icon="chevron-left" label="Back" onPress={actions.goBack} />
      </View>

      <Text {...a11yHeader()} variant="pageTitle" style={{ marginTop: spacing[5] }}>
        Notification preferences
      </Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: spacing[2] }}>
        Choose what reaches your lock screen. Everything else still appears in the in-app feed.
      </Text>

      {prefs.isPending ? (
        <View style={{ gap: spacing[3], marginTop: spacing[6] }}>
          <Skeleton height={360} radius="card" />
          <Skeleton height={144} radius="card" />
        </View>
      ) : prefs.isError || !prefs.data ? (
        <StateView
          tone="danger"
          icon="exclamation-triangle"
          title="Couldn't load your preferences"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void prefs.refetch()}
          style={{ marginTop: spacing[8] }}
        />
      ) : (
        <>
          <Text
            variant="overline"
            color="textSecondary"
            accessibilityRole="header"
            style={{ marginTop: spacing[7] }}
          >
            CATEGORIES
          </Text>
          <Card radius="card" padding={0} style={{ marginTop: spacing[3] }}>
            {NOTIFICATION_CATEGORIES.map((meta, index) => (
              <PrefRow
                key={meta.key}
                title={meta.label}
                caption={meta.description}
                ai={meta.ai}
                value={prefs.data.categories[meta.key]}
                divider={index > 0}
                onChange={(value) => setCategory(meta.key, value)}
              />
            ))}
          </Card>
          <Text variant="caption" color="textTertiary" style={{ marginTop: spacing[3] }}>
            Five categories, deliberately. Nothing else can be turned into a push.
          </Text>

          <Text
            variant="overline"
            color="textSecondary"
            accessibilityRole="header"
            style={{ marginTop: spacing[7] }}
          >
            DELIVERY
          </Text>
          <Card radius="card" padding={0} style={{ marginTop: spacing[3] }}>
            <PrefRow
              title="Quiet hours"
              caption="10pm – 8am, held until morning"
              value={prefs.data.quietHours}
              divider={false}
              onChange={(value) => patch({ quietHours: value })}
            />
            <PrefRow
              title="Weekly digest"
              caption="Anything you missed, Sunday 9am"
              value={prefs.data.weeklyDigest}
              divider
              onChange={(value) => patch({ weeklyDigest: value })}
            />
          </Card>

          {status !== 'unknown' ? (
            <Text variant="caption" color="textSecondary" style={{ marginTop: spacing[6] }}>
              {PERMISSION_COPY[status]}
            </Text>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const useStyles = scaledSheet((s) => ({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  prefRow: { flexDirection: 'row', alignItems: 'center' },
  prefText: { flex: 1, gap: s(2) },
  prefTitle: { flexDirection: 'row', alignItems: 'center' },
}));
