import { Linking, View } from 'react-native';

import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationPrefs,
} from '@/data/models';
import { registerPushDevice } from '@/data/pushDevice';
import { useNotificationPrefs, useSetNotificationPrefs } from '@/data/queries';
import { usePushPermission } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { AiBadge } from '@/ui/AiBadge';
import { Button } from '@/ui/Button';
import type { LineIconName } from '@/ui/Icon';
import { FlowCard, FlowDivider, IconTile, KitSection } from '@/ui/kit';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { SkeletonBlock } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { Toggle } from '@/ui/Toggle';

import { useNotificationsActions } from '../hooks/useNotificationsActions';

/** Each category's line icon, so a row reads at a glance (§198). */
const CATEGORY_ICON: Record<NotificationCategory, LineIconName> = {
  matches: 'Briefcase01',
  closing: 'Clock',
  applications: 'Send01',
  ai: 'Stars02',
  billing: 'CreditCard01',
};

type PrefRowProps = {
  icon: LineIconName;
  title: string;
  caption: string;
  ai?: boolean;
  value: boolean;
  onChange: (value: boolean) => void;
};

/** One switch: its icon tile, the title and what it sends, and the toggle. */
function PrefRow({ icon, title, caption, ai, value, onChange }: PrefRowProps) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <IconTile name={icon} size={40} tone={value ? 'brand' : 'neutral'} />
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text variant="bodyLgStrong" color="ink">
            {title}
          </Text>
          {ai ? <AiBadge /> : null}
        </View>
        <Text variant="footnote" color="textSecondary">
          {caption}
        </Text>
      </View>
      <Toggle value={value} onChange={onChange} label={title} />
    </View>
  );
}

/** What the phone-notifications card says in each permission state. */
const PERMISSION = {
  granted: {
    title: 'Notifications are on',
    body: 'You can turn them off any time in your phone’s settings.',
    icon: 'Bell01',
  },
  denied: {
    title: 'Notifications are off',
    body: 'Turn them on in your phone’s settings to get alerts.',
    icon: 'Bell01',
  },
  undetermined: {
    title: 'Get alerts on your phone',
    body: "You haven't allowed notifications yet.",
    icon: 'Bell01',
  },
} as const;

/**
 * Notification settings (redesigned 2026-11-09, §198): the phone's permission as a card at the
 * top with its one action, then what can notify you and how it is delivered, each switch with
 * its icon. Every change writes through the prefs repo optimistically, as before.
 */
export function NotificationPreferencesScreen() {
  const { u } = useTheme();
  const styles = useStyles();
  const actions = useNotificationsActions();
  const { status, request } = usePushPermission();

  const prefs = useNotificationPrefs();
  const setPrefs = useSetNotificationPrefs();

  const patch = (partial: Partial<NotificationPrefs>) => {
    if (prefs.data) setPrefs.mutate({ ...prefs.data, ...partial });
  };
  const setCategory = (category: NotificationCategory, value: boolean) => {
    if (prefs.data) patch({ categories: { ...prefs.data.categories, [category]: value } });
  };

  const permission = status === 'unknown' ? null : PERMISSION[status];

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Notification preferences" onBack={actions.goBack} />}
      contentContainerStyle={styles.content}
    >
      <Text variant="callout" color="textSecondary">
        Choose what reaches your lock screen. Everything else still appears in the in-app feed.
      </Text>

      {permission ? (
        <FlowCard highlight={status !== 'granted'} style={styles.permission}>
          <View style={styles.row}>
            <IconTile
              name={permission.icon}
              size={44}
              tone={status === 'granted' ? 'success' : 'solid'}
            />
            <View style={styles.text}>
              <Text variant="bodyLgStrong" color="ink">
                {permission.title}
              </Text>
              <Text variant="footnote" color="textSecondary">
                {permission.body}
              </Text>
            </View>
          </View>
          {status === 'undetermined' ? (
            <Button
              label="Turn on notifications"
              size="xl"
              block
              onPress={() =>
                void request().then((answer) => {
                  if (answer === 'granted') void registerPushDevice().catch(() => undefined);
                })
              }
            />
          ) : status === 'denied' ? (
            <Button
              label="Open device settings"
              variant="outline"
              size="xl"
              block
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
        </FlowCard>
      ) : null}

      {prefs.isPending ? (
        <View style={styles.sections}>
          <SkeletonBlock height={u(380)} />
          <SkeletonBlock height={u(150)} />
        </View>
      ) : prefs.isError || !prefs.data ? (
        <StateView
          tone="danger"
          icon="AlertTriangle"
          title="Couldn't load your preferences"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void prefs.refetch()}
        />
      ) : (
        <View style={styles.sections}>
          <KitSection title="What can notify you">
            <FlowCard style={styles.card}>
              {NOTIFICATION_CATEGORIES.map((meta, index) => (
                <View key={meta.key}>
                  {index > 0 ? <FlowDivider /> : null}
                  <PrefRow
                    icon={CATEGORY_ICON[meta.key]}
                    title={meta.label}
                    caption={meta.description}
                    ai={meta.ai}
                    value={prefs.data.categories[meta.key]}
                    onChange={(value) => setCategory(meta.key, value)}
                  />
                </View>
              ))}
            </FlowCard>
            <Text variant="footnote" color="textTertiary">
              Five categories, deliberately. Nothing else can be turned into a push.
            </Text>
          </KitSection>

          <KitSection title="Delivery">
            <FlowCard style={styles.card}>
              <PrefRow
                icon="Moon01"
                title="Quiet hours"
                caption="10pm – 8am, held until morning"
                value={prefs.data.quietHours}
                onChange={(value) => patch({ quietHours: value })}
              />
              <FlowDivider />
              <PrefRow
                icon="Calendar"
                title="Weekly digest"
                caption="Anything you missed, Sunday 9am"
                value={prefs.data.weeklyDigest}
                onChange={(value) => patch({ weeklyDigest: value })}
              />
            </FlowCard>
          </KitSection>
        </View>
      )}
    </Screen>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  content: { paddingTop: u(4), paddingBottom: u(32), gap: u(20) },
  permission: { gap: u(14) },
  sections: { gap: u(24) },
  card: { paddingVertical: u(4) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(12), paddingVertical: u(12) },
  text: { flex: 1, gap: u(2) },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
}));
