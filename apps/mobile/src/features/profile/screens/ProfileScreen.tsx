import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useCallback, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View, type ScrollView } from 'react-native';

import FontAwesome5 from '@expo/vector-icons/FontAwesome5';

import {
  AVAILABILITY_LABEL,
  LANGUAGE_LABEL,
  MAX_DESIRED_ROLES,
  NOTIFICATION_CATEGORIES,
  REMOTE_PREFERENCE_LABEL,
} from '@/data/models';
import {
  qk,
  useCompleteNextStep,
  useCurrentUser,
  useProfile,
  useSubscription,
  useUnreadCount,
} from '@/data/queries';
import { a11yButton, a11yHeader, formatLakh, pluralize } from '@/lib';
import { useTabScrollToTop } from '@/navigation';
import { useAppearanceStore, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { IconButton } from '@/ui/IconButton';
import { ListRow, RowGroup } from '@/ui/ListRow';
import { Pressable } from '@/ui/Pressable';
import { Screen } from '@/ui/Screen';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { CompletenessCard } from '../components/CompletenessCard';
import { PlanCard } from '../components/PlanCard';
import { ProfileIdentity } from '../components/ProfileIdentity';
import { ProfileSkeleton } from '../components/ProfileSkeleton';
import { ProfileStatsCard } from '../components/ProfileStatsCard';
import { useProfileActions } from '../hooks/useProfileActions';

const APPEARANCE_VALUE = { system: 'System', light: 'Light', dark: 'Dark' } as const;

/** Real build metadata arrives with EAS (plan §Phase 7); the build number is the artboard's. */
const VERSION_LINE = `NextKin ${Constants.expoConfig?.version ?? '1.0.0'} (build 128)`;

/**
 * PROFILE 01 + 02 (Figma 1:2189 / 1:2313) — one scroll screen; the second artboard is this
 * screen scrolled. Preference pickers and the two confirms are sheets raised through
 * profileStore; everything else links out (undesigned flows land on placeholders).
 */
export function ProfileScreen() {
  const { spacing } = useTheme();
  const actions = useProfileActions();
  const queryClient = useQueryClient();

  const user = useCurrentUser();
  const profile = useProfile();
  const subscription = useSubscription();
  const unread = useUnreadCount();
  const completeStep = useCompleteNextStep();
  const appearance = useAppearanceStore((state) => state.preference);

  const scrollRef = useRef<ScrollView>(null);
  useTabScrollToTop(
    'profile',
    useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), []),
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.profile.all }),
        queryClient.invalidateQueries({ queryKey: qk.user.all }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const header = (
    <View style={styles.titleRow}>
      <Text {...a11yHeader()} variant="screenTitle">
        Profile
      </Text>
      <IconButton
        icon="bell"
        iconStyle="regular"
        iconSize={18}
        label={(unread.data ?? 0) > 0 ? 'Notifications, unread' : 'Notifications'}
        dot={(unread.data ?? 0) > 0}
        onPress={actions.openNotifications}
      />
    </View>
  );

  if (user.isPending || profile.isPending) {
    return (
      <Screen tabBarInset contentContainerStyle={{ paddingTop: spacing[4], gap: spacing[5] }}>
        {header}
        <ProfileSkeleton />
      </Screen>
    );
  }

  if (user.isError || profile.isError || !user.data || !profile.data) {
    return (
      <Screen tabBarInset contentContainerStyle={{ paddingTop: spacing[4] }}>
        {header}
        <StateView
          tone="danger"
          icon="exclamation-triangle"
          title="Couldn't load your profile"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => {
            void user.refetch();
            void profile.refetch();
          }}
          style={{ marginTop: spacing[10] }}
        />
      </Screen>
    );
  }

  const current = profile.data;
  const prefs = current.preferences;

  return (
    <Screen
      scroll
      tabBarInset
      scrollRef={scrollRef}
      contentContainerStyle={{ paddingTop: spacing[4], gap: spacing[5] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {header}

      <ProfileIdentity user={user.data} profile={current} onEdit={actions.editProfile} />

      <ProfileStatsCard stats={current.stats} />

      <CompletenessCard profile={current} onCompleteStep={(id) => completeStep.mutate(id)} />

      {subscription.data ? (
        <PlanCard subscription={subscription.data} onUpgrade={actions.openUpgrade} />
      ) : null}

      <RowGroup title="CAREER PROFILE">
        <ListRow
          icon="briefcase"
          label="Work experience"
          value={pluralize(current.experiences.length, 'role')}
          onPress={actions.openExperience}
        />
        <ListRow
          icon="graduation-cap"
          label="Education"
          value={String(current.education.length)}
          onPress={actions.openEducation}
        />
        <ListRow
          icon="bolt"
          label="Skills"
          value={String(current.skills.length)}
          onPress={actions.openSkills}
        />
        <ListRow
          icon="certificate"
          label="Certifications"
          value={current.certifications.length > 0 ? String(current.certifications.length) : 'Add'}
          onPress={actions.openCertifications}
        />
        <ListRow
          icon="link"
          label="Links"
          value={current.links.map((link) => link.label).join(', ')}
          onPress={actions.openLinks}
        />
      </RowGroup>

      <View style={{ gap: spacing[3] }}>
        <RowGroup title="JOB PREFERENCES">
          <ListRow
            icon="star"
            label="Desired roles"
            value={`${prefs.desiredRoles.length} of ${MAX_DESIRED_ROLES}`}
            onPress={actions.openDesiredRoles}
          />
          <ListRow
            icon="map-marker-alt"
            label="Locations & remote"
            value={[...prefs.locations, REMOTE_PREFERENCE_LABEL[prefs.remote]].join(' · ')}
            onPress={actions.openLocations}
          />
          <ListRow
            icon="money-bill"
            label="Minimum salary"
            value={prefs.minSalary?.min != null ? formatLakh(prefs.minSalary.min) : 'Add'}
            onPress={actions.openMinSalary}
          />
          <ListRow
            icon="clock"
            label="Availability"
            value={AVAILABILITY_LABEL[prefs.availability]}
            onPress={actions.openAvailability}
          />
        </RowGroup>
        <Text variant="caption" color="textSecondary">
          Only used for matching — never shown on your resume.
        </Text>
      </View>

      <RowGroup title="SETTINGS">
        <ListRow
          icon="bell"
          label="Notifications"
          value={`${NOTIFICATION_CATEGORIES.length} categories`}
          onPress={actions.openNotificationPrefs}
        />
        <ListRow
          icon="moon"
          label="Appearance"
          value={APPEARANCE_VALUE[appearance]}
          onPress={actions.openAppearance}
        />
        <ListRow
          icon="globe"
          label="Language"
          value={LANGUAGE_LABEL[prefs.language]}
          onPress={actions.openLanguage}
        />
      </RowGroup>

      <RowGroup title="SUPPORT">
        <ListRow icon="question-circle" label="Help & FAQ" onPress={actions.openHelp} />
        <ListRow icon="envelope" label="Contact us" onPress={actions.openContact} />
        <ListRow icon="star" label="Rate NextKin" onPress={actions.openRate} />
        <ListRow icon="file-alt" label="Terms of service" onPress={actions.openTerms} />
        <ListRow icon="lock" label="Privacy policy" onPress={actions.openPrivacy} />
      </RowGroup>

      <RowGroup title="ACCOUNT">
        <ListRow icon="key" label="Email & password" onPress={actions.openAccountEmail} />
        <ListRow icon="download" label="Export my data" onPress={actions.openExportData} />
        <ListRow
          icon="trash"
          label="Delete account"
          tone="danger"
          accessibilityHint="Asks to confirm"
          onPress={actions.deleteAccount}
        />
      </RowGroup>

      {/* The artboard centres this one (1:2385), so it isn't a ListRow. */}
      <Card radius="card" padding={0}>
        <Pressable
          {...a11yButton('Sign out', 'Asks to confirm')}
          feedback="subtle"
          haptic="light"
          onPress={actions.signOut}
          style={[styles.signOut, { gap: spacing[2] + 2 }]}
        >
          <SignOutIcon />
          <Text variant="title" color="danger">
            Sign out
          </Text>
        </Pressable>
      </Card>

      <Text variant="micro" color="textTertiary" align="center" style={{ marginTop: spacing[2] }}>
        {VERSION_LINE}
      </Text>
    </Screen>
  );
}

function SignOutIcon() {
  const { colors } = useTheme();
  return <FontAwesome5 name="sign-out-alt" size={16} color={colors.danger} solid />;
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  signOut: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
