import { useCallback, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import CompanyArt from '../../../../assets/icons/jobs/company.svg';
import { useJob, useJobsByCompany } from '@/data/queries';
import { Art, ProfileCard, SectionHeading } from '@/features/profile/components/cards';
import { a11yButton, a11yHeader, openExternalUrl } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import type { ListRowArt } from '@/ui/ListRow';
import { Pressable } from '@/ui/Pressable';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { CompanyHero } from '../components/CompanyHero';
import { CompanyRoles } from '../components/CompanyRoles';
import { CompanySkeleton } from '../components/CompanySkeleton';
import { useJobsActions } from '../hooks/useJobsActions';
import { Icon } from '@/ui/Icon';

export type CompanyScreenProps = { jobId: string };

/** Said on the page, not in a toast: a pushed screen sits above every toast host in the app. */
const WEBSITE_UNAVAILABLE = 'Nothing on this device could open that address';

// JOBS 09 at 390 (580:1648), in artboard units.
const HEADER_TO_HERO = 10 / 0.75;
const HERO_TO_WEBSITE = 18 / 0.75;
const WEBSITE_TO_ABOUT = 14 / 0.75;
const ABOUT_TO_ROLES = 26 / 0.75;
const HEADING_TO_ROLES = 12 / 0.75;
const ROW_PAD_LEFT = 12 / 0.75;
const ROW_PAD_RIGHT = 16 / 0.75;
const ROW_PAD_Y = 10 / 0.75;
const ROW_GAP = 12 / 0.75;
const TILE = 36 / 0.75;
const TILE_RADIUS = 10 / 0.75;
const ABOUT_GAP = 10 / 0.75;
const ART_SLOT_W = 44 / 0.75;
const ART_SLOT_H = 30 / 0.75;

/** The About card's drawing (580:1676). */
const COMPANY_ART: ListRowArt = { Icon: CompanyArt, w: 42, h: 27.5143 };

/** Fixtures store a bare host ("stripe.com"); a real provider will return a full URL. */
const hostOf = (website: string): string =>
  website
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '');

const urlOf = (website: string): string =>
  /^https?:\/\//i.test(website) ? website : `https://${website}`;

/**
 * The employer behind a listing (V2 §7.13), drawn as JOBS 09 (580:1648): who they are, where to
 * read more, and their other open roles. No sticky bar — every action worth taking belongs to a
 * specific role and lives on its card.
 */
export function CompanyScreen({ jobId }: CompanyScreenProps) {
  const { colors, spacing, s } = useTheme();
  const styles = useStyles();
  const actions = useJobsActions();

  const job = useJob(jobId);
  // The route carries a JOB id, not a company, so the listings query cannot be asked for anything
  // until the job has been read. An empty name disables it — and a disabled query stays
  // `isPending` for ever, which is why the section's loading branch tests `company` as well.
  const company = job.data?.company ?? '';
  const listings = useJobsByCompany(company);

  const [message, setMessage] = useState<string | null>(null);
  const openWebsite = useCallback((website: string) => {
    setMessage(null);
    void openExternalUrl(urlOf(website)).then((result) => {
      // The wrapper returns 'unavailable' rather than throwing, and a silent no-op would leave
      // the reader tapping a dead row.
      if (result === 'unavailable') setMessage(WEBSITE_UNAVAILABLE);
    });
  }, []);

  // The board leaves the title slot empty: the hero names the company. While there is no company
  // (loading, error) the row names the page instead, so it is never a header-less screen.
  const page = (children: ReactNode, named = false) => (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={
        <ScreenHeader
          title={job.data?.company ?? 'Company'}
          showTitle={!named}
          onBack={actions.goBack}
        />
      }
      headerStyle={{ paddingBottom: s(HEADER_TO_HERO) }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
    >
      {children}
    </Screen>
  );

  // Gated on the id for the same reason as above: without one the query never runs, so falling
  // through to the error state is right and pulsing for ever is not.
  if (jobId.length > 0 && job.isPending) return page(<CompanySkeleton />);

  if (job.isError || !job.data) {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load this company"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void job.refetch()}
      />,
    );
  }

  const current = job.data;
  const website = hostOf(current.companyWebsite);
  // The reader arrived from this job and is already looking at it, so it is never one of the
  // "other" roles. Filtered here rather than in the repo, which stays a plain listing.
  const otherRoles = (listings.data ?? []).filter((role) => role.id !== current.id);
  const rolesReady = listings.isSuccess && otherRoles.length > 0;

  return page(
    <>
      <CompanyHero job={current} />

      <View style={[styles.website, { gap: spacing[2] }]}>
        <ProfileCard>
          <Pressable
            {...a11yButton(`Website, ${website}`, 'Opens in your browser')}
            feedback="subtle"
            haptic="light"
            onPress={() => openWebsite(current.companyWebsite)}
            style={styles.row}
          >
            <View style={[styles.tile, { backgroundColor: colors.tileBrandStrong }]}>
              <Icon name="Globe02" size="sm" color={colors.brand} />
            </View>
            <Text variant="menuRow" numberOfLines={1} style={styles.flex}>
              {website}
            </Text>
            <Icon name="LinkExternal01" size="sm" color={colors.textSecondary} />
          </Pressable>
        </ProfileCard>
        {message ? (
          <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}
      </View>

      {current.companyAbout ? (
        <ProfileCard style={[styles.about, { padding: spacing[5] }]}>
          <View style={styles.aboutHeader}>
            <View style={styles.artSlot}>
              <Art art={COMPANY_ART} width={COMPANY_ART.w} />
            </View>
            <Text {...a11yHeader()} variant="title" style={styles.flex}>
              About
            </Text>
          </View>
          <Text variant="captionRegular" color="textBody">
            {current.companyAbout}
          </Text>
        </ProfileCard>
      ) : null}

      <View style={styles.roles}>
        <SectionHeading
          title={`Open roles at ${current.company}`}
          note={
            rolesReady
              ? `${otherRoles.length} ${otherRoles.length === 1 ? 'role' : 'roles'}`
              : undefined
          }
        />
        <View style={styles.rolesBody}>
          <CompanyRoles
            company={current.company}
            roles={otherRoles}
            loading={company.length > 0 && listings.isPending}
            failed={listings.isError}
            onRetry={() => void listings.refetch()}
            onOpen={actions.openJob}
          />
        </View>
      </View>
    </>,
    true,
  );
}

const useStyles = scaledSheet((s) => ({
  website: { marginTop: s(HERO_TO_WEBSITE) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(ROW_GAP),
    paddingLeft: s(ROW_PAD_LEFT),
    paddingRight: s(ROW_PAD_RIGHT),
    paddingVertical: s(ROW_PAD_Y),
  },
  tile: {
    width: s(TILE),
    height: s(TILE),
    borderRadius: s(TILE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  about: { marginTop: s(WEBSITE_TO_ABOUT), gap: s(ABOUT_GAP) },
  aboutHeader: { flexDirection: 'row', alignItems: 'center', gap: s(ABOUT_GAP) },
  artSlot: {
    width: s(ART_SLOT_W),
    height: s(ART_SLOT_H),
    alignItems: 'center',
    justifyContent: 'center',
  },
  roles: { marginTop: s(ABOUT_TO_ROLES) },
  rolesBody: { marginTop: s(HEADING_TO_ROLES) },
}));
