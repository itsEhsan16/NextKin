import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useCallback, useRef, useState } from 'react';
import { RefreshControl, View, type ScrollViewInstance } from 'react-native';

import { qk, useCurrentUser, useProfile, useSubscription, useUnreadCount } from '@/data/queries';
import { a11yButton } from '@/lib';
import { useTabScrollToTop } from '@/navigation';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { ListRow, RowGroup } from '@/ui/ListRow';
import { Pressable } from '@/ui/Pressable';
import { Screen } from '@/ui/Screen';
import { StateView } from '@/ui/StateView';
import { TabTitleRow } from '@/ui/TabTitleRow';
import { Text } from '@/ui/Text';

import { CompletenessCard } from '../components/CompletenessCard';
import { PlanCard } from '../components/PlanCard';
import { ProfileIdentity } from '../components/ProfileIdentity';
import { ProfileSkeleton } from '../components/ProfileSkeleton';
import { ProfileStatsCard } from '../components/ProfileStatsCard';
import { useProfileActions } from '../hooks/useProfileActions';
import { PROFILE_ROW_ART as ART } from '../profileRowArt';
import { Icon } from '@/ui/Icon';

/**
 * The 390 board's respaced rhythm (toreview.md 38.1), in artboard units: 31 between the cards at
 * the top, 37 before each titled group, and 15 from the preferences card to its caption. A
 * group's overline sits 12 over its card, which is `RowGroup`'s own default. The title row → identity
 * seam is the tabs' shared `sizes.titleRowGap`; the identity → stats seam grew by 12.
 */
const CARD_GAP = 31;
const GROUP_EXTRA = 37 - CARD_GAP;
const PREFS_CAPTION_GAP = 15;
const HEADER_EXTRA = 12;
/** PROFILE 02: the Sign out card sits 35 under ACCOUNT, the version line 38 under it. */
const SIGN_OUT_EXTRA = 35 - CARD_GAP;
const VERSION_EXTRA = 38 - CARD_GAP;

/** Real build metadata arrives with EAS (plan §Phase 7); the build number is the artboard's. */
const VERSION_LINE = `NextKin ${Constants.expoConfig?.version ?? '1.0.0'} (build 128)`;

/**
 * PROFILE 01 + 02 (Figma 95:2390 / 95:2514) — one scroll screen; the second artboard is this
 * screen scrolled. Preference pickers and the two confirms are sheets raised through
 * profileStore; everything else links out (undesigned flows land on placeholders).
 */
export function ProfileScreen() {
  const { sizes, spacing, s } = useTheme();
  const styles = useStyles();
  const actions = useProfileActions();
  const queryClient = useQueryClient();

  const user = useCurrentUser();
  const profile = useProfile();
  const subscription = useSubscription();
  const unread = useUnreadCount();

  const scrollRef = useRef<ScrollViewInstance>(null);
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

  const titleRow = (
    <TabTitleRow
      title="Profile"
      hasUnread={(unread.data ?? 0) > 0}
      onPressNotifications={actions.openNotifications}
    />
  );

  // The header box, not `contentContainerStyle`, carries the top padding here: on a static
  // `Screen` the content style lands on the root after the safe-area padding and would replace
  // it, sliding the title under the status bar.
  const pendingHeaderStyle = { paddingTop: spacing.headerTop, paddingBottom: sizes.titleRowGap };

  if (user.isPending || profile.isPending) {
    return (
      <Screen header={titleRow} headerStyle={pendingHeaderStyle}>
        <ProfileSkeleton />
      </Screen>
    );
  }

  // Data-first: a failed background refresh keeps the profile on screen — only a query with
  // nothing to show is an error.
  if (!user.data || !profile.data) {
    return (
      <Screen header={titleRow} headerStyle={{ paddingTop: spacing.headerTop }}>
        <StateView
          tone="danger"
          icon="AlertTriangle"
          title="Couldn't load your profile"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => {
            void user.refetch();
            void profile.refetch();
          }}
        />
      </Screen>
    );
  }

  const current = profile.data;

  return (
    <Screen
      scroll
      tabBarInset
      scrollRef={scrollRef}
      // A fragment, not a View: fragments are not host nodes, so both rows become direct flex
      // children of the header box and its `gap` spaces them the way the container's did.
      header={
        <>
          {titleRow}
          <ProfileIdentity user={user.data} profile={current} onEdit={actions.editProfile} />
        </>
      }
      // `paddingBottom` rather than a `paddingTop` on the content, though both draw 15 at rest:
      // the completeness badge is absolutely positioned 7.5 *below* ProfileIdentity's own box, and
      // as content padding that ink would fall over the scroller — a later sibling, so it paints
      // on top, and Android clips it outright. Keeping it here also means no `overflow: 'hidden'`.
      headerStyle={{
        paddingTop: spacing.headerTop,
        gap: sizes.titleRowGap,
        paddingBottom: spacing[5] + s(HEADER_EXTRA),
      }}
      // The device pass that once widened this to 28 (groups read as one wall) is now answered by
      // the board itself: 31 between cards, 37 before each group.
      contentContainerStyle={{ gap: s(CARD_GAP) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ProfileStatsCard stats={current.stats} />

      <CompletenessCard profile={current} onOpenStep={actions.openNextStep} />

      {/* Wrapped: `openUpgrade` takes an optional reason, and the card has none to give (§85). */}
      {subscription.data ? (
        <PlanCard subscription={subscription.data} onUpgrade={() => actions.openUpgrade()} />
      ) : null}

      {/* Rows carry icon and title only (toreview.md 38.2) — the board hides every value. */}
      <RowGroup title="CAREER PROFILE" inset="art" style={{ marginTop: s(GROUP_EXTRA) }}>
        <ListRow art={ART.experience} label="Work experience" onPress={actions.openExperience} />
        <ListRow art={ART.education} label="Education" onPress={actions.openEducation} />
        <ListRow art={ART.skills} label="Skills" onPress={actions.openSkills} />
        <ListRow
          art={ART.certifications}
          label="Certifications"
          onPress={actions.openCertifications}
        />
        <ListRow art={ART.links} label="Links" onPress={actions.openLinks} />
      </RowGroup>

      <View style={{ gap: s(PREFS_CAPTION_GAP), marginTop: s(GROUP_EXTRA) }}>
        <RowGroup title="JOB PREFERENCES" inset="art">
          <ListRow
            art={ART.desiredRoles}
            label="Desired roles"
            onPress={actions.openDesiredRoles}
          />
          <ListRow art={ART.locations} label="Locations & remote" onPress={actions.openLocations} />
          <ListRow art={ART.minSalary} label="Minimum salary" onPress={actions.openMinSalary} />
          <ListRow art={ART.availability} label="Availability" onPress={actions.openAvailability} />
        </RowGroup>
        <Text variant="caption" color="textSecondary">
          Only used for matching — never shown on your resume.
        </Text>
      </View>

      <RowGroup title="SETTINGS" inset="art" style={{ marginTop: s(GROUP_EXTRA) }}>
        <ListRow
          art={ART.notifications}
          label="Notifications"
          onPress={actions.openNotificationPrefs}
        />
        <ListRow art={ART.appearance} label="Appearance" onPress={actions.openAppearance} />
        <ListRow art={ART.language} label="Language" onPress={actions.openLanguage} />
      </RowGroup>

      <RowGroup title="SUPPORT" inset="art" style={{ marginTop: s(GROUP_EXTRA) }}>
        <ListRow art={ART.help} label="Help & FAQ" onPress={actions.openHelp} />
        <ListRow art={ART.contact} label="Contact us" onPress={actions.openContact} />
        <ListRow art={ART.rate} label="Rate NextKin" onPress={actions.openRate} />
        <ListRow art={ART.terms} label="Terms of service" onPress={actions.openTerms} />
        <ListRow art={ART.privacy} label="Privacy policy" onPress={actions.openPrivacy} />
      </RowGroup>

      <RowGroup title="ACCOUNT" inset="art" style={{ marginTop: s(GROUP_EXTRA) }}>
        <ListRow
          art={ART.emailPassword}
          label="Email & password"
          onPress={actions.openAccountEmail}
        />
        <ListRow art={ART.exportData} label="Export my data" onPress={actions.openExportData} />
        <ListRow
          art={ART.deleteAccount}
          label="Delete account"
          tone="danger"
          accessibilityHint="Asks to confirm"
          onPress={actions.deleteAccount}
        />
      </RowGroup>

      {/* The artboard centres this one (95:2586), so it isn't a ListRow. */}
      <Card radius="card" padding={0} style={{ marginTop: s(SIGN_OUT_EXTRA) }}>
        <Pressable
          {...a11yButton('Sign out', 'Asks to confirm')}
          feedback="subtle"
          haptic="light"
          onPress={actions.signOut}
          style={[styles.signOut, { minHeight: sizes.listRow, gap: spacing[2] + 2 }]}
        >
          <SignOutIcon />
          <Text variant="title" color="danger">
            Sign out
          </Text>
        </Pressable>
      </Card>

      <Text
        variant="micro"
        color="textTertiary"
        align="center"
        style={{ marginTop: s(VERSION_EXTRA) }}
      >
        {VERSION_LINE}
      </Text>
    </Screen>
  );
}

function SignOutIcon() {
  const { colors } = useTheme();
  return <Icon name="LogOut01" size="sm" color={colors.danger} />;
}

const useStyles = scaledSheet((s) => ({
  // The height comes from sizes.listRow at the call site: a raw 58 here takes the flat scale
  // factor and lands at 43.5dp, under the 44pt floor.
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
